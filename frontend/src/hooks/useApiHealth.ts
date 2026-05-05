import { useState, useEffect, useCallback } from 'react';
import { apiUrl } from '@/lib/api';

export function useApiHealth() {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkHealth = useCallback(async () => {
    setIsChecking(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(apiUrl('/api/health'), {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json'
        }
      });
      
      clearTimeout(timeoutId);
      setIsOnline(response.ok);
    } catch (error) {
      clearTimeout(timeoutId);
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  return { isOnline, isChecking, retry: checkHealth };
}
