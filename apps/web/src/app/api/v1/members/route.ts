export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  db,
  teamMembers,
  users,
  invitations,
  subscriptions,
} from "@teamkit/db";
import { eq, and, count } from "drizzle-orm";
import { sendInvitationEmail } from "@/lib/email";
import { createAuditLog } from "@/lib/audit";
import { randomUUID } from "crypto";
import { z } from "zod";

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "member", "viewer"]).default("member"),
});

export async function GET() {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;
  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const members = await db
    .select({
      id: teamMembers.id,
      role: teamMembers.role,
      createdAt: teamMembers.createdAt,
      updatedAt: teamMembers.updatedAt,
      userId: teamMembers.userId,
      name: users.name,
      email: users.email,
      avatarUrl: users.avatarUrl,
    })
    .from(teamMembers)
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.workspaceId, workspaceId));

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;
  const actorId = (session as any)?.userId;
  const actorRole = (session as any)?.role;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only admin/owner can invite
  if (!["owner", "admin"].includes(actorRole ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { email, role } = parsed.data;

  // Check member limit
  const sub = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.workspaceId, workspaceId),
  });
  const plan = sub?.plan ?? "free";
  const limit = sub?.seatCount ?? 5;

  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(teamMembers)
    .where(eq(teamMembers.workspaceId, workspaceId));

  if (memberCount >= limit) {
    return NextResponse.json(
      {
        error: `Member limit reached (${limit} for ${plan} plan). Upgrade to add more members.`,
        code: "MEMBER_LIMIT_REACHED",
      },
      { status: 402 }
    );
  }

  // Check rate limit: max 50 invitations per workspace per day
  // (simplified — in production use Redis)
  const [{ inviteCount }] = await db
    .select({ inviteCount: count() })
    .from(invitations)
    .where(
      and(
        eq(invitations.workspaceId, workspaceId),
        eq(invitations.status, "pending")
      )
    );

  if (inviteCount >= 50) {
    return NextResponse.json(
      { error: "Daily invitation limit reached (50)", code: "RATE_LIMIT" },
      { status: 429 }
    );
  }

  // Generate token
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  const [invitation] = await db
    .insert(invitations)
    .values({
      workspaceId,
      email,
      role,
      token,
      invitedById: actorId,
      status: "pending",
      expiresAt,
    })
    .returning();

  // Get actor name for email
  const actor = await db.query.users.findFirst({
    where: eq(users.id, actorId),
  });

  // Get workspace name
  const ws = await db.query.workspaces.findFirst({
    where: (w, { eq }) => eq(w.id, workspaceId),
  });

  // Send invitation email (non-blocking)
  sendInvitationEmail({
    to: email,
    workspaceName: ws?.name ?? "TeamKit Workspace",
    inviterName: actor?.name ?? actor?.email ?? "A team member",
    role,
    token,
  }).catch(console.error);

  await createAuditLog({
    workspaceId,
    actorId,
    action: "member_invited",
    targetType: "invitation",
    targetId: invitation?.id,
    metadata: { email, role },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json(
    { invitation: { id: invitation?.id, email, role, expiresAt } },
    { status: 201 }
  );
}
