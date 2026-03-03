import { useCallback, useState } from "react";

interface Team {
  id: string;
  name: string;
  slug: string;
}

interface UseTeamReturn {
  team: Team | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTeam(_workspaceId: string): UseTeamReturn {
  const [team] = useState<Team | null>(null);
  const [isLoading] = useState(false);
  const [error] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    // TODO: implement fetch logic
  }, []);

  return { team, isLoading, error, refetch };
}
