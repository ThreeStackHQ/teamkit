import { pgTable, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core";
import { workspaces } from "./workspaces";

export const customRoles = pgTable("custom_roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id),
  name: varchar("name", { length: 100 }).notNull(),
  permissions: jsonb("permissions").notNull().default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
