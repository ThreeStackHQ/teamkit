export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { db, invitations, workspaces } from "@teamkit/db";
import { eq, and, lt, gt, isNull } from "drizzle-orm";
import {
  sendInviteReminderEmail as sendInvitationReminderEmail,
  sendInviteExpiredEmail as sendInvitationExpiredEmail,
} from "@/lib/email";

export async function GET(req: NextRequest) {
  // Verify CRON_SECRET
  const secret = req.headers.get("x-cron-secret") ??
    req.nextUrl.searchParams.get("secret");

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // 1. Find expired pending invitations (not yet accepted, past expiry)
  const expired = await db.query.invitations.findMany({
    where: and(
      isNull(invitations.acceptedAt),
      lt(invitations.expiresAt, now)
    ),
  });

  let expiredCount = 0;
  for (const invite of expired) {

    const ws = await db.query.workspaces.findFirst({
      where: (w, { eq }) => eq(w.id, invite.workspaceId),
    });

    sendInvitationExpiredEmail({
      to: invite.email,
      workspaceName: ws?.name ?? "TeamKit Workspace",
    }).catch(console.error);

    expiredCount++;
  }

  // 2. Send reminders for invitations created >24h ago that haven't expired yet
  const needsReminder = await db.query.invitations.findMany({
    where: and(
      isNull(invitations.acceptedAt),
      lt(invitations.createdAt, yesterday),
      gt(invitations.expiresAt, now)
    ),
  });

  let reminderCount = 0;
  for (const invite of needsReminder) {
    const ws = await db.query.workspaces.findFirst({
      where: (w, { eq }) => eq(w.id, invite.workspaceId),
    });

    sendInvitationReminderEmail({
      to: invite.email,
      workspaceName: ws?.name ?? "TeamKit Workspace",
      inviterName: "Your workspace admin",
      role: invite.role,
      token: invite.token,
    }).catch(console.error);

    reminderCount++;
  }

  return NextResponse.json({
    success: true,
    expired: expiredCount,
    reminders: reminderCount,
  });
}
