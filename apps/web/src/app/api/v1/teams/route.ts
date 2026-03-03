import { NextRequest, NextResponse } from "next/server";
import { eq, and, count } from "drizzle-orm";
import { db, workspaces, teamMembers } from "@teamkit/db";
import { apiAuth, getWorkspaceOrFail } from "@/lib/apiAuth";
import { env } from "@/lib/env";

const PLAN_TEAM_LIMITS: Record<string, number> = {
  free: 1,
  indie: 10,
  pro: Infinity,
};

// POST /api/v1/teams — create a new workspace/team
export async function POST(req: NextRequest) {
  const auth = await apiAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const workspace = await getWorkspaceOrFail(auth.workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  // Check plan limits: count existing workspaces owned by the same owner
  const [result] = await db
    .select({ value: count() })
    .from(workspaces)
    .where(eq(workspaces.ownerId, workspace.ownerId));

  const existingCount = result?.value ?? 0;
  const limit = PLAN_TEAM_LIMITS[workspace.plan] ?? 1;

  if (existingCount >= limit) {
    return NextResponse.json(
      {
        error: `Plan limit reached. Your ${workspace.plan} plan allows up to ${limit} team(s). Upgrade to create more.`,
        upgrade_url: `${env.NEXT_PUBLIC_APP_URL}/dashboard/billing`,
      },
      { status: 402 }
    );
  }

  const body = await req.json().catch(() => ({})) as { name?: string; slug?: string };
  const { name, slug } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const rawSlug = slug
    ? slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")
    : name.toLowerCase().replace(/[^a-z0-9]/g, "-");

  // Check slug uniqueness
  const existing = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.slug, rawSlug))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json({ error: "Slug is already taken" }, { status: 409 });
  }

  const [newWorkspace] = await db
    .insert(workspaces)
    .values({
      name: name.trim(),
      slug: rawSlug,
      ownerId: workspace.ownerId,
    })
    .returning();

  // Auto-add owner as team member
  await db.insert(teamMembers).values({
    workspaceId: newWorkspace!.id,
    userId: workspace.ownerId,
    role: "owner",
    inviteStatus: "accepted",
  });

  return NextResponse.json({ team: newWorkspace }, { status: 201 });
}
