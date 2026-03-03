import { NextRequest } from "next/server";
import { db, auditLogs } from "@teamkit/db";

export const AuditAction = {
  MEMBER_INVITED: "member.invited",
  MEMBER_REMOVED: "member.removed",
  MEMBER_ROLE_CHANGED: "member.role_changed",
  INVITE_ACCEPTED: "invite.accepted",
  INVITE_REVOKED: "invite.revoked",
  ROLE_CREATED: "role.created",
  ROLE_DELETED: "role.deleted",
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

interface LogEventParams {
  workspaceId: string;
  actorId?: string | null;
  action: AuditActionType;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  req?: NextRequest;
}

/** Alias used by session-auth routes (Wren convention) */
export async function createAuditLog(params: {
  workspaceId: string;
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await logEvent({
    workspaceId: params.workspaceId,
    actorId: params.actorId,
    action: params.action as AuditActionType,
    resourceType: params.targetType,
    resourceId: params.targetId,
    metadata: params.metadata,
  });
}

export async function logEvent(params: LogEventParams): Promise<void> {
  const { workspaceId, actorId, action, resourceType, resourceId, metadata, req } = params;

  const ipAddress =
    req?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req?.headers.get("x-real-ip") ??
    undefined;
  const userAgent = req?.headers.get("user-agent") ?? undefined;

  await db.insert(auditLogs).values({
    workspaceId,
    actorId: actorId ?? null,
    action,
    resourceType: resourceType ?? null,
    resourceId: resourceId ?? null,
    metadata: metadata ?? {},
    ipAddress: ipAddress ?? null,
    userAgent: userAgent ?? null,
  });
}
