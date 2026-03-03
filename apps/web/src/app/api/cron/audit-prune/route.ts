import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { eq, and, lt, inArray } from "drizzle-orm";
import { db, auditLogs, workspaces } from "@teamkit/db";
import { env } from "@/lib/env";

const RETENTION_DAYS: Record<string, number> = {
  free: 30,
  indie: 90,
  pro: 365,
};

// POST /api/cron/audit-prune — authenticated via CRON_SECRET
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

  let pruned = 0;

  // Process each plan retention tier
  for (const [plan, days] of Object.entries(RETENTION_DAYS)) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get workspace IDs on this plan
    const planWorkspaces = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.plan, plan as "free" | "indie" | "pro"));

    if (planWorkspaces.length === 0) continue;

    const workspaceIds = planWorkspaces.map((w) => w.id);

    const result = await db
      .delete(auditLogs)
      .where(
        and(
          inArray(auditLogs.workspaceId, workspaceIds),
          lt(auditLogs.createdAt, cutoff)
        )
      )
      .returning({ id: auditLogs.id });

    pruned += result.length;
  }

  return NextResponse.json({ pruned });
}
