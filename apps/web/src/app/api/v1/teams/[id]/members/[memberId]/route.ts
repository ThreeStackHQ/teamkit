import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, teamMembers, workspaces } from "@teamkit/db";
import { apiAuth } from "@/lib/apiAuth";
import { logEvent, AuditAction } from "@/lib/audit";

// PATCH /api/v1/teams/:id/members/:memberId — change role
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  const auth = await apiAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: workspaceId, memberId } = params;

  if (auth.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as {
    role?: string;
    actorUserId?: string;
  };

  const { role: newRole, actorUserId } = body;

  const validRoles = ["owner", "admin", "member", "viewer"];
  if (!newRole || !validRoles.includes(newRole)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
      { status: 400 }
    );
  }

  const [targetMember] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.id, memberId),
        eq(teamMembers.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Cannot self-promote
  if (actorUserId && actorUserId === targetMember.userId) {
    return NextResponse.json({ error: "Cannot change your own role" }, { status: 403 });
  }

  // Determine actor's role for permission check
  if (actorUserId) {
    const [actorMember] = await db
      .select()
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, actorUserId),
          eq(teamMembers.workspaceId, workspaceId)
        )
      )
      .limit(1);

    if (!actorMember) {
      return NextResponse.json({ error: "Actor is not a member of this workspace" }, { status: 403 });
    }

    // Only owner can assign/change owner role
    if ((newRole === "owner" || targetMember.role === "owner") && actorMember.role !== "owner") {
      return NextResponse.json(
        { error: "Only an owner can assign or change the owner role" },
        { status: 403 }
      );
    }

    // Admin can change member/viewer roles
    if (actorMember.role !== "owner" && actorMember.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins and owners can change member roles" },
        { status: 403 }
      );
    }
  }

  const [updated] = await db
    .update(teamMembers)
    .set({ role: newRole as "owner" | "admin" | "member" | "viewer" })
    .where(eq(teamMembers.id, memberId))
    .returning();

  await logEvent({
    workspaceId,
    actorId: actorUserId,
    action: AuditAction.MEMBER_ROLE_CHANGED,
    resourceType: "team_member",
    resourceId: memberId,
    metadata: { previousRole: targetMember.role, newRole },
    req,
  });

  return NextResponse.json({ member: updated }, { status: 200 });
}

// DELETE /api/v1/teams/:id/members/:memberId — remove member
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; memberId: string } }
) {
  const auth = await apiAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: workspaceId, memberId } = params;

  if (auth.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [targetMember] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.id, memberId),
        eq(teamMembers.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (targetMember.role === "owner") {
    return NextResponse.json(
      { error: "Cannot remove the workspace owner" },
      { status: 409 }
    );
  }

  await db.delete(teamMembers).where(eq(teamMembers.id, memberId));

  const actorUserId = req.headers.get("x-actor-user-id");

  await logEvent({
    workspaceId,
    actorId: actorUserId ?? undefined,
    action: AuditAction.MEMBER_REMOVED,
    resourceType: "team_member",
    resourceId: memberId,
    metadata: { removedRole: targetMember.role, userId: targetMember.userId },
    req,
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
