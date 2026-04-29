import { useState, useEffect, useCallback } from 'react';
import { api } from '@shared/utils/api';

/**
 * Simple data-fetching hook.
 * @param {string} url - API endpoint
 * @param {string} token - optional auth token
 */
export function useFetch(url, token) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get(url, token);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [url, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
