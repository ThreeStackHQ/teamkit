export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, invitations, teamMembers, users } from "@teamkit/db";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const invite = await db.query.invitations.findFirst({
    where: eq(invitations.token, token),
  });

  if (!invite) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  if (invite.status !== "pending") {
    return NextResponse.json(
      { error: "Invitation already used or expired", code: "INVITE_USED" },
      { status: 410 }
    );
  }

  if (new Date() > invite.expiresAt) {
    // Mark as expired
    await db
      .update(invitations)
      .set({ status: "expired" })
      .where(eq(invitations.id, invite.id));
    return NextResponse.json(
      { error: "Invitation expired", code: "INVITE_EXPIRED" },
      { status: 410 }
    );
  }

  const session = await auth();
  const userId = (session as any)?.userId;

  if (!session || !userId) {
    // Redirect to login with callback
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=/invite/accept?token=${token}`, req.url)
    );
  }

  // Check if user email matches
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (user?.email !== invite.email) {
    return NextResponse.json(
      { error: "This invitation was sent to a different email address" },
      { status: 403 }
    );
  }

  // Check if already a member
  const existing = await db.query.teamMembers.findFirst({
    where: and(
      eq(teamMembers.userId, userId),
      eq(teamMembers.workspaceId, invite.workspaceId)
    ),
  });

  if (existing) {
    // Already a member — mark invite accepted
    await db
      .update(invitations)
      .set({ status: "accepted" })
      .where(eq(invitations.id, invite.id));
    return NextResponse.json(
      { success: true, alreadyMember: true, workspaceId: invite.workspaceId },
      { status: 200 }
    );
  }

  // Create team membership
  const [member] = await db
    .insert(teamMembers)
    .values({
      userId,
      workspaceId: invite.workspaceId,
      role: invite.role,
    })
    .returning();

  // Mark invitation as accepted
  await db
    .update(invitations)
    .set({ status: "accepted" })
    .where(eq(invitations.id, invite.id));

  await createAuditLog({
    workspaceId: invite.workspaceId,
    actorId: userId,
    action: "member_accepted",
    targetType: "invitation",
    targetId: invite.id,
    metadata: { email: invite.email, role: invite.role },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({
    success: true,
    workspaceId: invite.workspaceId,
    member: { id: member?.id, role: invite.role },
  });
}
