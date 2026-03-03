export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, customRoles, teamMembers, subscriptions } from "@teamkit/db";
import { eq, and, count } from "drizzle-orm";
import { createAuditLog } from "@/lib/audit";
import { validatePermissions } from "@/lib/permissions";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  permissions: z.array(z.string()).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { roleId: string } }
) {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;
  const actorId = (session as any)?.userId;
  const actorRole = (session as any)?.role;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.workspaceId, workspaceId),
  });
  if (sub?.plan !== "pro") {
    return NextResponse.json(
      { error: "Custom roles are a Pro feature" },
      { status: 402 }
    );
  }

  if (!["owner", "admin"].includes(actorRole ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = await db.query.customRoles.findFirst({
    where: and(
      eq(customRoles.id, params.roleId),
      eq(customRoles.workspaceId, workspaceId)
    ),
  });

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, permissions: rawPerms } = parsed.data;
  const permissions = rawPerms ? validatePermissions(rawPerms) : undefined;

  const [updated] = await db
    .update(customRoles)
    .set({
      ...(name ? { name } : {}),
      ...(permissions !== undefined ? { permissions } : {}),
      updatedAt: new Date(),
    })
    .where(eq(customRoles.id, params.roleId))
    .returning();

  await createAuditLog({
    workspaceId,
    actorId,
    action: "custom_role_updated",
    targetType: "custom_role",
    targetId: params.roleId,
    metadata: { name, permissions },
  });

  return NextResponse.json({ role: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { roleId: string } }
) {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;
  const actorId = (session as any)?.userId;
  const actorRole = (session as any)?.role;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.workspaceId, workspaceId),
  });
  if (sub?.plan !== "pro") {
    return NextResponse.json(
      { error: "Custom roles are a Pro feature" },
      { status: 402 }
    );
  }

  if (actorRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const role = await db.query.customRoles.findFirst({
    where: and(
      eq(customRoles.id, params.roleId),
      eq(customRoles.workspaceId, workspaceId)
    ),
  });

  if (!role) {
    return NextResponse.json({ error: "Role not found" }, { status: 404 });
  }

  // Check if any members have this role
  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(teamMembers)
    .where(eq(teamMembers.roleId, params.roleId));

  if (memberCount > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete role: ${memberCount} member(s) have this role`,
        code: "ROLE_IN_USE",
      },
      { status: 409 }
    );
  }

  await db.delete(customRoles).where(eq(customRoles.id, params.roleId));

  await createAuditLog({
    workspaceId,
    actorId,
    action: "custom_role_deleted",
    targetType: "custom_role",
    targetId: params.roleId,
    metadata: { name: role.name },
  });

  return NextResponse.json({ success: true });
}
