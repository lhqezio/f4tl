import { useQuery } from '@tanstack/react-query';
import { fetchSessions } from '../lib/api';

export function useSessions() {
  return useQuery({
    queryKey: ['sessions'],
    queryFn: fetchSessions,
    refetchInterval: 10000,
  });
}
