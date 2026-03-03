import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { eq, and, isNull, lt, gt, sql } from "drizzle-orm";
import { db, invitations, workspaces } from "@teamkit/db";
import { env } from "@/lib/env";
import { sendInviteReminderEmail, sendInviteExpiredEmail } from "@/lib/email";

// POST /api/cron/invite-reminders — authenticated via CRON_SECRET
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const providedSecret = authHeader?.replace("Bearer ", "") ?? "";

  const expected = Buffer.from(env.CRON_SECRET);
  const provided = Buffer.from(providedSecret);

  const isValid =
    provided.length === expected.length &&
    timingSafeEqual(expected, provided);

  if (!isValid) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Send reminders for invitations that:
  // - Are not accepted (acceptedAt IS NULL)
  // - Were created ~24 hours ago (between 23h and 25h ago)
  // - Have not yet expired
  const reminderWindowStart = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const reminderWindowEnd = new Date(now.getTime() - 23 * 60 * 60 * 1000);

  const pendingReminders = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      role: invitations.role,
      token: invitations.token,
      workspaceId: invitations.workspaceId,
      workspaceName: workspaces.name,
    })
    .from(invitations)
    .leftJoin(workspaces, eq(invitations.workspaceId, workspaces.id))
    .where(
      and(
        isNull(invitations.acceptedAt),
        gt(invitations.expiresAt, now),
        lt(invitations.createdAt, reminderWindowEnd),
        gt(invitations.createdAt, reminderWindowStart)
      )
    );

  let remindersCount = 0;
  for (const inv of pendingReminders) {
    if (!inv.workspaceName) continue;
    const acceptUrl = `${env.NEXT_PUBLIC_APP_URL}/api/invite/accept?token=${inv.token}`;
    await sendInviteReminderEmail({
      to: inv.email,
      workspaceName: inv.workspaceName,
      role: inv.role,
      acceptUrl,
    }).catch(console.error);
    remindersCount++;
  }

  // Send expiry notifications for invitations that:
  // - Just expired (between 48h and 49h ago)
  // - Were not accepted
  const expiredWindowStart = new Date(now.getTime() - 49 * 60 * 60 * 1000);
  const expiredWindowEnd = new Date(now.getTime() - 47 * 60 * 60 * 1000);

  const justExpired = await db
    .select({
      id: invitations.id,
      email: invitations.email,
      workspaceName: workspaces.name,
    })
    .from(invitations)
    .leftJoin(workspaces, eq(invitations.workspaceId, workspaces.id))
    .where(
      and(
        isNull(invitations.acceptedAt),
        lt(invitations.expiresAt, expiredWindowEnd),
        gt(invitations.expiresAt, expiredWindowStart)
      )
    );

  let expiredCount = 0;
  for (const inv of justExpired) {
    if (!inv.workspaceName) continue;
    await sendInviteExpiredEmail({
      to: inv.email,
      workspaceName: inv.workspaceName,
    }).catch(console.error);
    expiredCount++;
  }

  return NextResponse.json({
    reminders_sent: remindersCount,
    expiry_notifications_sent: expiredCount,
  });
}
