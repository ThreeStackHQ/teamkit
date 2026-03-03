export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, workspaceApiKeys } from "@teamkit/db";
import { eq } from "drizzle-orm";
import { createAuditLog } from "@/lib/audit";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  expiresAt: z.string().datetime().optional(),
});

export async function GET() {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return API keys WITHOUT the actual key hash (security)
  const keys = await db
    .select({
      id: workspaceApiKeys.id,
      name: workspaceApiKeys.name,
      keyPrefix: workspaceApiKeys.keyPrefix,
      lastUsedAt: workspaceApiKeys.lastUsedAt,
      expiresAt: workspaceApiKeys.expiresAt,
      createdAt: workspaceApiKeys.createdAt,
    })
    .from(workspaceApiKeys)
    .where(eq(workspaceApiKeys.workspaceId, workspaceId));

  return NextResponse.json({ keys });
}

export async function POST(req: NextRequest) {
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

  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { name, expiresAt } = parsed.data;

  // Generate API key: tk_live_<random>
  const rawKey = `tk_live_${randomBytes(32).toString("hex")}`;
  const keyPrefix = rawKey.substring(0, 12); // "tk_live_XXXX"
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const [apiKey] = await db
    .insert(workspaceApiKeys)
    .values({
      workspaceId,
      name,
      keyHash,
      keyPrefix,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    })
    .returning({
      id: workspaceApiKeys.id,
      name: workspaceApiKeys.name,
      keyPrefix: workspaceApiKeys.keyPrefix,
      createdAt: workspaceApiKeys.createdAt,
    });

  await createAuditLog({
    workspaceId,
    actorId,
    action: "api_key_created",
    targetType: "api_key",
    targetId: apiKey?.id,
    metadata: { name, keyPrefix },
    ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
  });

  // ONE-TIME REVEAL: return the full key only on creation
  return NextResponse.json(
    {
      apiKey: {
        ...apiKey,
        // This is the ONLY time the full key is returned
        key: rawKey,
        warning: "Store this key securely — it will not be shown again.",
      },
    },
    { status: 201 }
  );
}
