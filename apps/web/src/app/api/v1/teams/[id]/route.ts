import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db, workspaces, teamMembers, users } from "@teamkit/db";
import { apiAuth } from "@/lib/apiAuth";

// GET /api/v1/teams/:id
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await apiAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = params;

  // Only allow access to workspaces belonging to the same owner
  const [workspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, id))
    .limit(1);

  if (!workspace) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  // Ensure the requesting workspace and target are owned by the same user
  const [authWorkspace] = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, auth.workspaceId))
    .limit(1);

  if (!authWorkspace || authWorkspace.ownerId !== workspace.ownerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch members with user info
  const members = await db
    .select({
      id: teamMembers.id,
      role: teamMembers.role,
      inviteStatus: teamMembers.inviteStatus,
      createdAt: teamMembers.createdAt,
      user: {
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
      },
    })
    .from(teamMembers)
    .leftJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.workspaceId, id));

  return NextResponse.json({ team: workspace, members }, { status: 200 });
}
