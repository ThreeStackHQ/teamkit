export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, customRoles, workspaces } from "@teamkit/db";
import { eq, and } from "drizzle-orm";
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
  const workspaceId = (session as unknown as { workspaceId?: string })?.workspaceId;
  const actorId = (session as unknown as { userId?: string })?.userId;
  const actorRole = (session as unknown as { role?: string })?.role;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });
  if (ws?.plan !== "pro") {
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
  const workspaceId = (session as unknown as { workspaceId?: string })?.workspaceId;
  const actorId = (session as unknown as { userId?: string })?.userId;
  const actorRole = (session as unknown as { role?: string })?.role;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ws = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, workspaceId),
  });
  if (ws?.plan !== "pro") {
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

  // TODO: check member count once team_members has a roleId FK for custom roles

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
