import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, invitations } from "@teamkit/db";
import { apiAuth } from "@/lib/apiAuth";
import { logEvent, AuditAction } from "@/lib/audit";

// DELETE /api/v1/teams/:id/invites/:inviteId
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; inviteId: string } }
) {
  const auth = await apiAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id: workspaceId, inviteId } = params;

  if (auth.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [invitation] = await db
    .select()
    .from(invitations)
    .where(
      and(
        eq(invitations.id, inviteId),
        eq(invitations.workspaceId, workspaceId)
      )
    )
    .limit(1);

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  if (invitation.acceptedAt) {
    return NextResponse.json(
      { error: "Cannot revoke an already accepted invitation" },
      { status: 409 }
    );
  }

  await db
    .delete(invitations)
    .where(eq(invitations.id, inviteId));

  await logEvent({
    workspaceId,
    action: AuditAction.INVITE_REVOKED,
    resourceType: "invitation",
    resourceId: inviteId,
    metadata: { email: invitation.email },
    req,
  });

  return NextResponse.json({ success: true }, { status: 200 });
}
