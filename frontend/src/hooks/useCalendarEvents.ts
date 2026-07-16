import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch, ensureArray } from '@/lib/api';
import { toast } from '@/stores/toastStore';

export function useCalendarEvents() {
  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => apiFetch('/api/meetings').catch(() => []).then(ensureArray),
  });

  const syncGoogle = useMutation({
    mutationFn: () => apiFetch('/api/calendar/sync', { method: 'POST' }),
    onSuccess: () => {
      toast('Google Calendar sincronizado', 'success');
      refetch();
    },
    onError: (e: Error) => toast(e.message || 'Erro ao sincronizar', 'error'),
  });

  return { events, isLoading, refetch, syncGoogle };
}
