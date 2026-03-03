import { useCallback, useState } from "react";

interface AuditLogEntry {
  id: string;
  action: string;
  actorId: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface UseAuditLogReturn {
  entries: AuditLogEntry[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useAuditLog(_workspaceId: string): UseAuditLogReturn {
  const [entries] = useState<AuditLogEntry[]>([]);
  const [isLoading] = useState(false);
  const [error] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    // TODO: implement fetch logic
  }, []);

  return { entries, isLoading, error, refetch };
}
