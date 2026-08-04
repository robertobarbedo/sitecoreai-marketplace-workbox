"use client";

import type { ClientSDK } from "@sitecore-marketplace-sdk/client";
import { useCallback, useRef, useState } from "react";

import type { ScanProgress, ScanResult } from "@/src/types/workbox";
import { ScopeNotFoundError, runScan, type ScanOptions } from "@/src/utils/scan";

export interface UseWorkboxScan {
  result: ScanResult | null;
  progress: ScanProgress | null;
  isScanning: boolean;
  error: string | null;
  start: (options: ScanOptions) => Promise<void>;
  cancel: () => void;
}

/**
 * Drives one scan at a time. A newer scan supersedes an older one: the older run
 * sees a bumped run id and drops its results instead of overwriting the new ones.
 */
export function useWorkboxScan(
  client: ClientSDK | null,
  sitecoreContextId: string,
): UseWorkboxScan {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [progress, setProgress] = useState<ScanProgress | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancelRef = useRef(false);
  const runIdRef = useRef(0);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const start = useCallback(
    async (options: ScanOptions) => {
      if (!client || !sitecoreContextId) return;

      const runId = ++runIdRef.current;
      cancelRef.current = false;
      setIsScanning(true);
      setError(null);
      setProgress({ scanned: 0, total: 0, truncated: false });

      try {
        const scanResult = await runScan(client, sitecoreContextId, options, {
          onProgress: (next) => {
            if (runIdRef.current === runId) setProgress(next);
          },
          isCancelled: () => cancelRef.current || runIdRef.current !== runId,
        });

        if (runIdRef.current !== runId) return;
        setResult(scanResult);
        setProgress(scanResult.progress);
      } catch (err) {
        if (runIdRef.current !== runId) return;
        setResult(null);
        setError(
          err instanceof ScopeNotFoundError
            ? `Could not find "${err.scopePath}" in this environment.`
            : err instanceof Error
              ? err.message
              : String(err),
        );
      } finally {
        if (runIdRef.current === runId) setIsScanning(false);
      }
    },
    [client, sitecoreContextId],
  );

  return { result, progress, isScanning, error, start, cancel };
}
