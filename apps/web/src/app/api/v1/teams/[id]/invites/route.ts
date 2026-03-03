import { NextRequest, NextResponse } from "next/server";
import { eq, and, gt, count, isNull, sql } from "drizzle-orm";
import { db, workspaces, teamMembers, invitations, users } from "@teamkit/db";
import { apiAuth } from "@/lib/apiAuth";
import { logEvent, AuditAction } from "@/lib/audit";
import { sendInvitationEmail } from "@/lib/email";
import { env } from "@/lib/env";

const PLAN_MEMBER_LIMITS: Record<string, number> = {
  free: 5,
  indie: 25,
  pro: Infinity,
};

const MAX_DAILY_INVITES = 50;

// POST /api/v1/teams/:id/invites
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await apiAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: workspaceId } = params;

  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Verify API key belongs to this workspace
  if (auth.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: max 50 invitations per workspace per day
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [dailyCount] = await db
    .select({ value: count() })
    .from(invitations)
    .where(
      and(
        eq(invitations.workspaceId, workspaceId),
        gt(invitations.createdAt, oneDayAgo)
      )
    );

  if ((dailyCount?.value ?? 0) >= MAX_DAILY_INVITES) {
    return NextResponse.json(
      { error: "Daily invitation limit (50) reached. Try again tomorrow." },
      { status: 429 }
    );
  }

  // Check member count limits
  const [memberCount] = await db
    .select({ value: count() })
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.workspaceId, workspaceId),
        eq(teamMembers.inviteStatus, "accepted")
      )
    );

  const memberLimit = PLAN_MEMBER_LIMITS[workspace.plan] ?? 5;
  if (memberLimit !== Infinity && (memberCount?.value ?? 0) >= memberLimit) {
    return NextResponse.json(
      {
        error: `Member limit (${memberLimit}) reached for ${workspace.plan} plan. Upgrade to invite more members.`,
        upgrade_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({})) as {
    email?: string;
    role?: string;
    invitedByUserId?: string;
  };

  const { email, role = "member", invitedByUserId } = body;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  const validRoles = ["owner", "admin", "member", "viewer"];
  if (!validRoles.includes(role)) {
    return NextResponse.json(
      { error: `Invalid role. Must be one of: ${validRoles.join(", ")}` },
      { status: 400 }
    );
  }

  // Don't invite if already an accepted member
  const existingMember = await db
    .select()
    .from(teamMembers)
    .leftJoin(users, eq(teamMembers.userId, users.id))
    .where(
      and(
        eq(teamMembers.workspaceId, workspaceId),
        sql`${users.email} = ${email.toLowerCase()}`,
        eq(teamMembers.inviteStatus, "accepted")
      )
    )
    .limit(1);

  if (existingMember.length > 0) {
    return NextResponse.json(
      { error: "User is already a member of this workspace" },
      { status: 409 }
    );
  }

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const [invitation] = await db
    .insert(invitations)
    .values({
      workspaceId,
      email: email.toLowerCase(),
      role: role as "owner" | "admin" | "member" | "viewer",
      invitedById: invitedByUserId ?? null,
      expiresAt,
    })
    .returning();

  if (!invitation) {
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }

  // Get inviter name
  let inviterName = "A team admin";
  if (invitedByUserId) {
    const [inviter] = await db
      .select()
      .from(users)
      .where(eq(users.id, invitedByUserId))
      .limit(1);
    if (inviter?.name) inviterName = inviter.name;
    else if (inviter?.email) inviterName = inviter.email;
  }

  const acceptUrl = `${env.NEXT_PUBLIC_APP_URL}/api/invite/accept?token=${invitation.token}`;

  // Send invitation email (fire and forget)
  sendInvitationEmail({
    to: email,
    workspaceName: workspace.name,
    inviterName,
    role,
    acceptUrl,
  }).catch(console.error);

  await logEvent({
    workspaceId,
    actorId: invitedByUserId,
    action: AuditAction.MEMBER_INVITED,
    resourceType: "invitation",
    resourceId: invitation.id,
    metadata: { email, role },
    req,
  });

  return NextResponse.json({ invitation }, { status: 201 });
}
