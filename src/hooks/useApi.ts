"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseApiOptions<T> = {
  shouldKeepPrevious?: (previous: T, next: T) => boolean;
};

export function useApi<T>(endpoint: string, options: UseApiOptions<T> = {}) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [preservedPrevious, setPreservedPrevious] = useState(false);
  const hasDataRef = useRef(false);
  const shouldKeepPrevious = options.shouldKeepPrevious;

  const fetchApi = useCallback(async (isBackgroundPoll = false) => {
    try {
      if (!isBackgroundPoll && !hasDataRef.current) {
        setLoading(true);
      }
      const res = await fetch(endpoint, { cache: "no-store" });
      if (!res.ok) throw new Error(`API failed: ${res.status}`);
      const json = (await res.json()) as T;
      setData((previous) => {
        if (previous && shouldKeepPrevious?.(previous, json)) {
          setPreservedPrevious(true);
          return previous;
        }
        setPreservedPrevious(false);
        return json;
      });
      hasDataRef.current = true;
      setError(null);
    } catch (e: unknown) {
      console.error(e);
      setError(e instanceof Error ? e : new Error("API request failed"));
    } finally {
      setLoading(false);
    }
  }, [endpoint, shouldKeepPrevious]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchApi();
    // Poll frequently enough for cross-wallet workflow handoffs to feel live.
    const interval = setInterval(() => {
      void fetchApi(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [fetchApi]);

  return { data, loading, error, mutate: fetchApi, preservedPrevious };
}
