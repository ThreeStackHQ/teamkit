export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, invitations } from "@teamkit/db";
import { eq, and, isNull } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  const workspaceId = (session as unknown as { workspaceId?: string })?.workspaceId;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await db.query.invitations.findMany({
    where: and(
      eq(invitations.workspaceId, workspaceId),
      isNull(invitations.acceptedAt)
    ),
  });

  return NextResponse.json({ invitations: pending });
}
