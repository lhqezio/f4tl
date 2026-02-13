import { useQuery } from '@tanstack/react-query';
import { fetchConfig } from '../lib/api';

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
    staleTime: 60_000,
  });
}
