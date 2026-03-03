import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db, users, workspaces, teamMembers, auditLogs } from "@teamkit/db";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db as any),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_ID!,
      clientSecret: process.env.GITHUB_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (user?.id) {
        // Find the user's primary workspace
        const member = await db.query.teamMembers.findFirst({
          where: eq(teamMembers.userId, user.id),
          with: { workspace: true },
          orderBy: (tm, { asc }) => [asc(tm.createdAt)],
        });

        (session as any).userId = user.id;
        if (member) {
          (session as any).workspaceId = member.workspaceId;
          (session as any).role = member.role;
        }
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user.id || !user.email) return;

      // Auto-create workspace on first signup
      const slug = user.email.split("@")[0]!.toLowerCase().replace(/[^a-z0-9]/g, "-");
      const workspaceName = user.name ?? user.email.split("@")[0]!;

      const [workspace] = await db
        .insert(workspaces)
        .values({
          name: workspaceName,
          slug: `${slug}-${Date.now()}`,
          ownerId: user.id,
        })
        .returning();

      if (!workspace) return;

      // Add user as owner
      await db.insert(teamMembers).values({
        userId: user.id,
        workspaceId: workspace.id,
        role: "owner",
      });

      // Audit log
      await db.insert(auditLogs).values({
        workspaceId: workspace.id,
        actorId: user.id,
        action: "workspace_created",
        targetType: "workspace",
        targetId: workspace.id,
        metadata: { workspaceName: workspace.name },
      });
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "database",
  },
});

export type SessionWithWorkspace = {
  userId: string;
  workspaceId: string;
  role: string;
  user: { name?: string | null; email?: string | null; image?: string | null };
  expires: string;
};
