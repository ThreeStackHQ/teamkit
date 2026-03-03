import { NextRequest, NextResponse } from "next/server";
import { eq, and, isNull } from "drizzle-orm";
import { db, invitations, teamMembers, users } from "@teamkit/db";
import { logEvent, AuditAction } from "@/lib/audit";
import { env } from "@/lib/env";

// GET /api/invite/accept?token=...
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/login?error=invalid_token", env.NEXT_PUBLIC_APP_URL));
  }

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(eq(invitations.token, token))
    .limit(1);

  if (!invitation) {
    return NextResponse.redirect(
      new URL("/login?error=invitation_not_found", env.NEXT_PUBLIC_APP_URL)
    );
  }

  if (invitation.acceptedAt) {
    return NextResponse.redirect(
      new URL("/dashboard?notice=invitation_already_accepted", env.NEXT_PUBLIC_APP_URL)
    );
  }

  if (invitation.expiresAt < new Date()) {
    return NextResponse.redirect(
      new URL("/login?error=invitation_expired", env.NEXT_PUBLIC_APP_URL)
    );
  }

  // Find or note user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, invitation.email))
    .limit(1);

  if (!user) {
    // User doesn't have an account yet — redirect to sign in with the email pre-filled
    const loginUrl = new URL("/login", env.NEXT_PUBLIC_APP_URL);
    loginUrl.searchParams.set("email", invitation.email);
    loginUrl.searchParams.set("invite_token", token);
    return NextResponse.redirect(loginUrl);
  }

  // Check if already a member
  const [existingMember] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.workspaceId, invitation.workspaceId),
        eq(teamMembers.userId, user.id)
      )
    )
    .limit(1);

  if (existingMember) {
    // Already a member, just mark invitation as accepted
    await db
      .update(invitations)
      .set({ acceptedAt: new Date() })
      .where(eq(invitations.id, invitation.id));

    return NextResponse.redirect(
      new URL("/dashboard?notice=already_member", env.NEXT_PUBLIC_APP_URL)
    );
  }

  // Create team member row
  await db.insert(teamMembers).values({
    workspaceId: invitation.workspaceId,
    userId: user.id,
    role: invitation.role,
    inviteStatus: "accepted",
  });

  // Mark invitation as accepted
  await db
    .update(invitations)
    .set({ acceptedAt: new Date() })
    .where(eq(invitations.id, invitation.id));

  await logEvent({
    workspaceId: invitation.workspaceId,
    actorId: user.id,
    action: AuditAction.INVITE_ACCEPTED,
    resourceType: "invitation",
    resourceId: invitation.id,
    metadata: { email: invitation.email, role: invitation.role },
    req,
  });

  return NextResponse.redirect(
    new URL(`/dashboard?notice=invitation_accepted`, env.NEXT_PUBLIC_APP_URL)
  );
}
