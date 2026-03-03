export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, invitations } from "@teamkit/db";
import { eq, and } from "drizzle-orm";

export async function GET() {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const pending = await db.query.invitations.findMany({
    where: and(
      eq(invitations.workspaceId, workspaceId),
      eq(invitations.status, "pending")
    ),
  });

  return NextResponse.json({ invitations: pending });
}
