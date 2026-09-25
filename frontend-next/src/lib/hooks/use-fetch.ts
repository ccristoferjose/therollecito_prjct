'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, ApiError } from '@/lib/api/client';

/** Client-side data-fetching hook (browser, with optional auth token). */
export function useFetch<T = unknown>(url: string | null, token?: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // True once any request has finished (success or error). Lets callers show
  // a full-page loader only for the very first load, and keep their UI mounted
  // during later refetches.
  const [settled, setSettled] = useState(false);

  const fetchData = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<T>(url, token);
      setData(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Request failed');
    } finally {
      setLoading(false);
      setSettled(true);
    }
  }, [url, token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, settled, refetch: fetchData };
}
