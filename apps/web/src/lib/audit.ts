import { db, auditLogs } from "@teamkit/db";

export type AuditAction =
  | "member_invited"
  | "member_accepted"
  | "member_removed"
  | "role_changed"
  | "api_key_created"
  | "api_key_revoked"
  | "plan_changed"
  | "workspace_updated"
  | "workspace_created"
  | "invite_cancelled"
  | "custom_role_created"
  | "custom_role_updated"
  | "custom_role_deleted";

export async function createAuditLog({
  workspaceId,
  actorId,
  action,
  targetType,
  targetId,
  metadata,
  ipAddress,
}: {
  workspaceId: string;
  actorId?: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}) {
  try {
    await db.insert(auditLogs).values({
      workspaceId,
      actorId: actorId ?? null,
      action,
      targetType: targetType ?? null,
      targetId: targetId ?? null,
      metadata: metadata ?? {},
      ipAddress: ipAddress ?? null,
    });
  } catch (error) {
    // Audit log failures should never break the main flow
    console.error("Failed to create audit log:", error);
  }
}
