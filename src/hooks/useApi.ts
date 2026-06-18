"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useApi<T>(endpoint: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const hasDataRef = useRef(false);

  const fetchApi = useCallback(async (isBackgroundPoll = false) => {
    try {
      if (!isBackgroundPoll && !hasDataRef.current) {
        setLoading(true);
      }
      const res = await fetch(endpoint);
      if (!res.ok) throw new Error(`API failed: ${res.status}`);
      const json = (await res.json()) as T;
      setData(json);
      hasDataRef.current = true;
      setError(null);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e : new Error("API request failed"));
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchApi();
    // Poll every 2 seconds for live feeling in demo mode
    const interval = setInterval(() => {
      void fetchApi(true);
    }, 2000);
    return () => clearInterval(interval);
  }, [fetchApi]);

  return { data, loading, error, mutate: fetchApi };
}
