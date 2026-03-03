export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, teamMembers, users } from "@teamkit/db";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const patchSchema = z.object({
  role: z.enum(["admin", "member", "viewer"]).optional(),
  roleId: z.string().uuid().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;
  const actorId = (session as any)?.userId;
  const actorRole = (session as any)?.role;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only owner can change roles
  if (actorRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // IDOR: verify member belongs to this workspace
  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.id, params.memberId),
      eq(teamMembers.workspaceId, workspaceId)
    ),
  });

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Cannot change own role
  if (member.userId === actorId) {
    return NextResponse.json(
      { error: "Cannot change your own role" },
      { status: 400 }
    );
  }

  // Cannot demote the owner
  if (member.role === "owner") {
    return NextResponse.json(
      { error: "Cannot change the owner role" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { role } = parsed.data;
  if (!role) {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

  const oldRole = member.role;

  const [updated] = await db
    .update(teamMembers)
    .set({ role })
    .where(eq(teamMembers.id, params.memberId))
    .returning();

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, member.userId),
  });

  await createAuditLog({
    workspaceId,
    actorId,
    action: "role_changed",
    targetType: "team_member",
    targetId: member.id,
    metadata: {
      userId: member.userId,
      email: targetUser?.email,
      oldRole,
      newRole: role,
    },
  });

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { memberId: string } }
) {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;
  const actorId = (session as any)?.userId;
  const actorRole = (session as any)?.role;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only owner can remove members
  if (actorRole !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // IDOR: verify member belongs to this workspace
  const member = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.id, params.memberId),
      eq(teamMembers.workspaceId, workspaceId)
    ),
  });

  if (!member) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Cannot remove yourself
  if (member.userId === actorId) {
    return NextResponse.json(
      { error: "Cannot remove yourself" },
      { status: 400 }
    );
  }

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, member.userId),
  });

  await db.delete(teamMembers).where(eq(teamMembers.id, params.memberId));

  await createAuditLog({
    workspaceId,
    actorId,
    action: "member_removed",
    targetType: "team_member",
    targetId: member.id,
    metadata: { userId: member.userId, email: targetUser?.email },
  });

  return NextResponse.json({ success: true });
}
