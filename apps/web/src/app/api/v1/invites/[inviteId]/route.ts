export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, invitations } from "@teamkit/db";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "@/lib/audit";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { inviteId: string } }
) {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;
  const actorId = (session as any)?.userId;
  const actorRole = (session as any)?.role;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!["owner", "admin"].includes(actorRole ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // IDOR check
  const invite = await db.query.invitations.findFirst({
    where: and(
      eq(invitations.id, params.inviteId),
      eq(invitations.workspaceId, workspaceId)
    ),
  });

  if (!invite) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  await db
    .update(invitations)
    .set({ status: "expired" })
    .where(eq(invitations.id, params.inviteId));

  await createAuditLog({
    workspaceId,
    actorId,
    action: "invite_cancelled",
    targetType: "invitation",
    targetId: params.inviteId,
    metadata: { email: invite.email },
  });

  return NextResponse.json({ success: true });
}
