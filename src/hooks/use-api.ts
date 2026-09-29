"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, errorMessage } from "@/lib/api-client";

export function useApi<T>(path: string | null, reloadKey = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));

  const load = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setData(await apiFetch<T>(path));
    } catch (err) {
      setError(errorMessage(err));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  return { data, error, loading, reload: load };
}
