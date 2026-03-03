export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, workspaceApiKeys } from "@teamkit/db";
import { eq, and } from "drizzle-orm";
import { createAuditLog } from "@/lib/audit";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { keyId: string } }
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

  // IDOR: verify key belongs to this workspace
  const key = await db.query.workspaceApiKeys.findFirst({
    where: and(
      eq(workspaceApiKeys.id, params.keyId),
      eq(workspaceApiKeys.workspaceId, workspaceId)
    ),
  });

  if (!key) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  await db
    .delete(workspaceApiKeys)
    .where(eq(workspaceApiKeys.id, params.keyId));

  await createAuditLog({
    workspaceId,
    actorId,
    action: "api_key_revoked",
    targetType: "api_key",
    targetId: params.keyId,
    metadata: { name: key.name, keyPrefix: key.keyPrefix },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  });

  return NextResponse.json({ success: true });
}
