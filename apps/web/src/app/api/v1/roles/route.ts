import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, customRoles, workspaces } from "@teamkit/db";
import { apiAuth, getWorkspaceOrFail } from "@/lib/apiAuth";
import { logEvent, AuditAction } from "@/lib/audit";

const VALID_PERMISSIONS = [
  "manage_members",
  "manage_billing",
  "manage_roles",
  "view_audit_log",
  "manage_settings",
] as const;

type Permission = (typeof VALID_PERMISSIONS)[number];

function validatePermissions(perms: unknown): perms is Permission[] {
  if (!Array.isArray(perms)) return false;
  return perms.every((p) => VALID_PERMISSIONS.includes(p as Permission));
}

// POST /api/v1/roles — Pro only
export async function POST(req: NextRequest) {
  const auth = await apiAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const workspace = await getWorkspaceOrFail(auth.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (workspace.plan !== "pro") {
    return NextResponse.json(
      {
        error: "Custom roles require a Pro plan",
        upgrade_url: "/dashboard/billing",
      },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({})) as { name?: string; permissions?: unknown };
  const { name, permissions = [] } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  if (!validatePermissions(permissions)) {
    return NextResponse.json(
      {
        error: `Invalid permissions. Allowed values: ${VALID_PERMISSIONS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const [role] = await db
    .insert(customRoles)
    .values({
      workspaceId: auth.workspaceId,
      name: name.trim(),
      permissions,
    })
    .returning();

  await logEvent({
    workspaceId: auth.workspaceId,
    action: AuditAction.ROLE_CREATED,
    resourceType: "custom_role",
    resourceId: role!.id,
    metadata: { name, permissions },
    req,
  });

  return NextResponse.json({ role }, { status: 201 });
}

// GET /api/v1/roles
export async function GET(req: NextRequest) {
  const auth = await apiAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const roles = await db
    .select()
    .from(customRoles)
    .where(eq(customRoles.workspaceId, auth.workspaceId));

  return NextResponse.json({ roles });
}
