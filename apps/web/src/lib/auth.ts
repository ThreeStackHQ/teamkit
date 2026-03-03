import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { randomBytes, createHash } from "crypto";
import { eq } from "drizzle-orm";
import type { NextAuthOptions } from "next-auth";
import { getServerSession as nextAuthGetServerSession } from "next-auth/next";
import EmailProvider from "next-auth/providers/email";
import { db } from "@teamkit/db";
import {
  users,
  workspaces,
  teamMembers,
  workspaceApiKeys,
  accounts,
  sessions,
  verificationTokens,
} from "@teamkit/db";
import { env } from "./env";

export const authOptions: NextAuthOptions = {
  // DrizzleAdapter types require newer drizzle-orm; cast is safe at runtime
  adapter: DrizzleAdapter(db, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usersTable: users as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accountsTable: accounts as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionsTable: sessions as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verificationTokensTable: verificationTokens as any,
  }),
  providers: [
    EmailProvider({
      from: "TeamKit <noreply@teamkit.io>",
      server: {
        host: "smtp.resend.com",
        port: 465,
        auth: {
          user: "resend",
          pass: env.RESEND_API_KEY,
        },
      },
    }),
  ],
  session: { strategy: "database" },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        (session.user as { id?: string }).id = user.id;
      }
      return session;
    },
    async signIn({ user }) {
      if (!user.id || !user.email) return true;

      try {
        // Check if workspace already exists for this user
        const [existingWorkspace] = await db
          .select()
          .from(workspaces)
          .where(eq(workspaces.ownerId, user.id))
          .limit(1);

        if (existingWorkspace) return true; // Not a new user

        // Derive slug from email prefix
        const emailPrefix = user.email.split("@")[0]!;
        const baseSlug = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, "-");

        // Ensure slug is unique
        let slug = baseSlug;
        let attempt = 0;
        while (true) {
          const existing = await db
            .select()
            .from(workspaces)
            .where(eq(workspaces.slug, slug))
            .limit(1);
          if (existing.length === 0) break;
          attempt++;
          slug = `${baseSlug}-${attempt}`;
        }

        // Create workspace
        const [workspace] = await db
          .insert(workspaces)
          .values({
            name: `${user.email.split("@")[0]}'s Workspace`,
            slug,
            ownerId: user.id,
          })
          .returning();

        if (!workspace) throw new Error("Failed to create workspace");

        // Assign owner role
        await db.insert(teamMembers).values({
          workspaceId: workspace.id,
          userId: user.id,
          role: "owner",
          inviteStatus: "accepted",
        });

        // Generate API key (show once, store SHA-256 hash)
        const rawKey = randomBytes(32).toString("hex");
        const keyHash = createHash("sha256").update(rawKey).digest("hex");

        await db.insert(workspaceApiKeys).values({
          workspaceId: workspace.id,
          name: "Default API Key",
          keyHash,
        });

        // Log new workspace + key creation
        console.info(
          `[TeamKit] New workspace created: ${workspace.slug}\n` +
          `[TeamKit] API key (show once): ${rawKey}`
        );
      } catch (err) {
        console.error("[TeamKit] Error setting up new workspace:", err);
      }

      return true;
    },
  },
  pages: {
    signIn: "/login",
    verifyRequest: "/verify",
  },
};

export async function getServerSession() {
  return nextAuthGetServerSession(authOptions);
}

/** Alias used by session-auth routes */
export const auth = getServerSession;
