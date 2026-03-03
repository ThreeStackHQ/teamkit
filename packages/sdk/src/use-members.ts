import { useCallback, useState } from "react";

interface Member {
  id: string;
  userId: string;
  role: string;
  name: string | null;
  email: string;
}

interface UseMembersReturn {
  members: Member[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useMembers(_workspaceId: string): UseMembersReturn {
  const [members] = useState<Member[]>([]);
  const [isLoading] = useState(false);
  const [error] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    // TODO: implement fetch logic
  }, []);

  return { members, isLoading, error, refetch };
}
