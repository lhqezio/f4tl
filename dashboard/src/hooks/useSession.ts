import { useQuery } from '@tanstack/react-query';
import { fetchSession } from '../lib/api';

export function useSession(id: string | undefined) {
  return useQuery({
    queryKey: ['session', id],
    queryFn: () => fetchSession(id ?? ''),
    enabled: !!id,
  });
}
