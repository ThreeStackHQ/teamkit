import { NextRequest, NextResponse } from "next/server";
import { eq, and, desc, lt, gte, sql } from "drizzle-orm";
import { db, auditLogs } from "@teamkit/db";
import { apiAuth } from "@/lib/apiAuth";

// GET /api/v1/audit?page=1&limit=50&action=&resourceType=
export async function GET(req: NextRequest) {
  const auth = await apiAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const actionFilter = searchParams.get("action") ?? "";
  const resourceTypeFilter = searchParams.get("resourceType") ?? "";

  const offset = (page - 1) * limit;

  const conditions = [eq(auditLogs.workspaceId, auth.workspaceId)];
  if (actionFilter) {
    conditions.push(eq(auditLogs.action, actionFilter));
  }
  if (resourceTypeFilter) {
    conditions.push(eq(auditLogs.resourceType, resourceTypeFilter));
  }

  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditLogs)
    .where(and(...conditions));

  return NextResponse.json({
    logs: rows,
    pagination: {
      page,
      limit,
      total: countResult?.total ?? 0,
      pages: Math.ceil((countResult?.total ?? 0) / limit),
    },
  });
}
