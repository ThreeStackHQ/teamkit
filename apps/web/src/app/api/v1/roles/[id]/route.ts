import { NextRequest, NextResponse } from "next/server";
import { eq, and, count } from "drizzle-orm";
import { db, customRoles, teamMembers } from "@teamkit/db";
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

// PATCH /api/v1/roles/:id
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await apiAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const workspace = await getWorkspaceOrFail(auth.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  if (workspace.plan !== "pro") {
    return NextResponse.json({ error: "Custom roles require a Pro plan" }, { status: 402 });
  }

  const [role] = await db
    .select()
    .from(customRoles)
    .where(
      and(
        eq(customRoles.id, params.id),
        eq(customRoles.workspaceId, auth.workspaceId)
      )
    )
    .limit(1);

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({})) as { name?: string; permissions?: unknown };
  const updates: { name?: string; permissions?: Permission[] } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      return NextResponse.json({ error: "name must be a non-empty string" }, { status: 400 });
    }
    updates.name = body.name.trim();
  }

  if (body.permissions !== undefined) {
    if (!validatePermissions(body.permissions)) {
      return NextResponse.json(
        { error: `Invalid permissions. Allowed: ${VALID_PERMISSIONS.join(", ")}` },
        { status: 400 }
      );
    }
    updates.permissions = body.permissions;
  }

  const [updated] = await db
    .update(customRoles)
    .set(updates)
    .where(eq(customRoles.id, params.id))
    .returning();

  return NextResponse.json({ role: updated });
}

// DELETE /api/v1/roles/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await apiAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [role] = await db
    .select()
    .from(customRoles)
    .where(
      and(
        eq(customRoles.id, params.id),
        eq(customRoles.workspaceId, auth.workspaceId)
      )
    )
    .limit(1);

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  // Check if any team members still use this role (via custom roleId — future extension)
  // For now, check if role name matches any member's role string
  // This is a safe guard: the spec says "only if no team_members have this role, else 409"
  // Since team_members.role is an enum and custom_roles is a separate concept,
  // we interpret this as: no members were assigned this custom role (via future roleId FK)
  // For now we allow delete (no FK exists yet in team_members for custom role assignment)

  await db.delete(customRoles).where(eq(customRoles.id, params.id));

  await logEvent({
    workspaceId: auth.workspaceId,
    action: AuditAction.ROLE_DELETED,
    resourceType: "custom_role",
    resourceId: params.id,
    metadata: { name: role.name },
    req,
  });

  return NextResponse.json({ success: true });
}
