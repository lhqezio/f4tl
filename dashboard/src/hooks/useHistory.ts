import { useQuery } from '@tanstack/react-query';
import { fetchHistory, fetchBugLedger } from '../lib/api';

export function useHistory(limit = 50) {
  return useQuery({
    queryKey: ['history', limit],
    queryFn: () => fetchHistory({ limit }),
    refetchInterval: 30000,
  });
}

export function useBugLedger(limit = 100) {
  return useQuery({
    queryKey: ['bugLedger', limit],
    queryFn: () => fetchBugLedger({ limit }),
    refetchInterval: 30000,
  });
}
