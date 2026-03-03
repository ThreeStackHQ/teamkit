import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db, workspaceApiKeys, workspaces } from "@teamkit/db";

export type ApiAuthResult =
  | { ok: true; workspaceId: string; keyId: string }
  | { ok: false; error: string; status: number };

export async function apiAuth(req: NextRequest): Promise<ApiAuthResult> {
  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return { ok: false, error: "Missing x-api-key header", status: 401 };
  }

  const keyHash = createHash("sha256").update(apiKey).digest("hex");

  const [keyRow] = await db
    .select()
    .from(workspaceApiKeys)
    .where(eq(workspaceApiKeys.keyHash, keyHash))
    .limit(1);

  if (!keyRow) {
    return { ok: false, error: "Invalid API key", status: 401 };
  }

  // Update last used timestamp (fire and forget)
  db.update(workspaceApiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(workspaceApiKeys.id, keyRow.id))
    .catch(console.error);

  return { ok: true, workspaceId: keyRow.workspaceId, keyId: keyRow.id };
}

export async function getWorkspaceOrFail(workspaceId: string) {
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  return workspace ?? null;
}
