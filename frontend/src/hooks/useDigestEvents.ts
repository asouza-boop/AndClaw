import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiUrl, getToken } from '@/lib/api';

export interface DigestEvent {
  type: 'memory.digested';
  timestamp: string;
}

export function useDigestEvents(onDigested?: (data: DigestEvent) => void) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const token = getToken();
    const url = apiUrl(`/api/events/digest${token ? `?token=${token}` : ''}`);
    const source = new EventSource(url, { withCredentials: true });

    source.onmessage = (event) => {
      try {
        const data: DigestEvent = JSON.parse(event.data);
        if (data.type === 'memory.digested') {
          // Invalidate both memory and links since digestion might affect both
          queryClient.invalidateQueries({ queryKey: ['memory'] });
          queryClient.invalidateQueries({ queryKey: ['links'] });
          
          if (onDigested) {
            onDigested(data);
          }
        }
      } catch (err) {
        // Fail silently on parse error
      }
    };

    source.onerror = () => {
      // Fail silently and close on error to prevent infinite retries if backend is down
      source.close();
    };

    return () => {
      source.close();
    };
  }, [queryClient, onDigested]);
}
