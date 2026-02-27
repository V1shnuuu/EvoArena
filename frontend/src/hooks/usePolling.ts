"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * #17 — Real-Time Polling Hook
 *
 * Generic hook that polls a data-fetching function at a configurable interval.
 * Provides loading / error states and manual refresh.
 */
export function usePolling<T>(
  fetchFn: () => Promise<T>,
  intervalMs: number = 5000,
  enabled: boolean = true
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchFn();
      if (mountedRef.current) {
        setData(result);
        setError(null);
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err.message || "Fetch error");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setLoading(false);
      return;
    }

    // Initial fetch
    refresh();

    // Start polling
    timerRef.current = setInterval(refresh, intervalMs);

    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh, intervalMs, enabled]);

  return { data, loading, error, refresh };
}

/**
 * useBlockNumber — polls the latest block number.
 */
export function useBlockNumber(provider: any, intervalMs: number = 3000) {
  const fetchBlock = useCallback(async () => {
    if (!provider) return 0;
    return provider.getBlockNumber();
  }, [provider]);

  return usePolling(fetchBlock, intervalMs, !!provider);
}
