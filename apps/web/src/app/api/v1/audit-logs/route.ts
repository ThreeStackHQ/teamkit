export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db, auditLogs, users, subscriptions } from "@teamkit/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth();
  const workspaceId = (session as any)?.workspaceId;
  const role = (session as any)?.role;

  if (!session || !workspaceId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const format = searchParams.get("format");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "50"), 200);
  const offset = parseInt(searchParams.get("offset") ?? "0");
  const action = searchParams.get("action");
  const actorId = searchParams.get("actorId");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");

  // Check for CSV export — Pro only
  if (format === "csv") {
    const sub = await db.query.subscriptions.findFirst({
      where: eq(subscriptions.workspaceId, workspaceId),
    });
    if (sub?.plan !== "pro") {
      return NextResponse.json(
        { error: "CSV export is a Pro feature", code: "PLAN_REQUIRED" },
        { status: 402 }
      );
    }
  }

  const conditions = [eq(auditLogs.workspaceId, workspaceId)];
  if (action) conditions.push(eq(auditLogs.action, action));
  if (actorId) conditions.push(eq(auditLogs.actorId, actorId));
  if (dateFrom) conditions.push(gte(auditLogs.createdAt, new Date(dateFrom)));
  if (dateTo) conditions.push(lte(auditLogs.createdAt, new Date(dateTo)));

  const logs = await db
    .select({
      id: auditLogs.id,
      workspaceId: auditLogs.workspaceId,
      actorId: auditLogs.actorId,
      action: auditLogs.action,
      targetType: auditLogs.targetType,
      targetId: auditLogs.targetId,
      metadata: auditLogs.metadata,
      ipAddress: auditLogs.ipAddress,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
      actorEmail: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorId, users.id))
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit)
    .offset(offset);

  if (format === "csv") {
    const csv = [
      "id,action,actorName,actorEmail,targetType,targetId,ipAddress,createdAt",
      ...logs.map((l) =>
        [
          l.id,
          l.action,
          l.actorName ?? "",
          l.actorEmail ?? "",
          l.targetType ?? "",
          l.targetId ?? "",
          l.ipAddress ?? "",
          l.createdAt.toISOString(),
        ].join(",")
      ),
    ].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="audit-log-${Date.now()}.csv"`,
      },
    });
  }

  return NextResponse.json({ logs, limit, offset });
}
