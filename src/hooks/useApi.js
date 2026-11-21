import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { useUI } from '../context/UIProvider.jsx';

export function useApiQuery(path, { enabled = true, onError } = {}) {
  const { toast } = useUI();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const mounted = useRef(true);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    api
      .get(path, { signal: controller.signal })
      .then((response) => {
        if (mounted.current) setData(response);
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        if (mounted.current) {
          setError(requestError);
          if (onErrorRef.current) onErrorRef.current(requestError);
          else if (requestError.status !== 401) toast.error(requestError.message);
        }
      })
      .finally(() => {
        if (mounted.current && !controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, enabled, refreshKey, toast]);

  const refetch = useCallback(() => setRefreshKey((value) => value + 1), []);

  return { data, loading, error, refetch, setData };
}

export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · TallerTech Manager` : 'TallerTech Manager';
  }, [title]);
}
