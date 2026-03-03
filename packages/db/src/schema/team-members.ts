import { pgTable, uuid, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { workspaces } from "./workspaces";

export const memberRoleEnum = pgEnum("member_role", ["owner", "admin", "member", "viewer"]);
export const inviteStatusEnum = pgEnum("invite_status", ["pending", "accepted"]);

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRoleEnum("role").notNull().default("member"),
    inviteStatus: inviteStatusEnum("invite_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    uniqWorkspaceUser: unique("team_members_workspace_user_unique").on(
      t.workspaceId,
      t.userId
    ),
  })
);
