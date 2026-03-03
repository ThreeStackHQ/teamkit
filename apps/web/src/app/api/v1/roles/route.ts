export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, customRoles, subscriptions, teamMembers } from "@teamkit/db";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "@/lib/audit";
import {
  VALID_PERMISSIONS,
  validatePermissions,
  DEFAULT_ROLE_PERMISSIONS,
  DEFAULT_ROLES,
} from "@/lib/permissions";
import { z } from "zod";

const createRoleSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()),
});

async function requirePro(workspaceId: string) {
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.workspaceId, workspaceId),
  });
  return sub?.plan === "pro";
}

export async function GET() {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Default roles
  const defaultRoles = DEFAULT_ROLES.map((role) => ({
    id: role,
    name: role,
    permissions: DEFAULT_ROLE_PERMISSIONS[role] ?? [],
    isDefault: true,
  }));

  // Custom roles (Pro only)
  const isPro = await requirePro(workspaceId);
  if (!isPro) {
    return NextResponse.json({ roles: defaultRoles });
  }

  const custom = await db.query.customRoles.findMany({
    where: eq(customRoles.workspaceId, workspaceId),
  });

  return NextResponse.json({
    roles: [
      ...defaultRoles,
      ...custom.map((r) => ({ ...r, isDefault: false })),
    ],
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;
  const actorId = (session as any)?.userId;
  const actorRole = (session as any)?.role;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Pro only
  const isPro = await requirePro(workspaceId);
  if (!isPro) {
    return NextResponse.json(
      { error: "Custom roles are a Pro feature", code: "PLAN_REQUIRED" },
      { status: 402 }
    );
  }

  if (!["owner", "admin"].includes(actorRole ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createRoleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, permissions: rawPerms } = parsed.data;

  // Validate permissions — no arbitrary strings
  const permissions = validatePermissions(rawPerms);

  const [role] = await db
    .insert(customRoles)
    .values({
      workspaceId,
      name,
      permissions,
    })
    .returning();

  await createAuditLog({
    workspaceId,
    actorId,
    action: "custom_role_created",
    targetType: "custom_role",
    targetId: role?.id,
    metadata: { name, permissions },
  });

  return NextResponse.json({ role }, { status: 201 });
}
