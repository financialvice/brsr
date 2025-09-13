import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useState } from "react";

export function useIsDefaultBrowser(options?: { pollMs?: number }) {
  const pollMs = options?.pollMs ?? 60_000;
  const [isDefaultBrowser, setIsDefaultBrowser] = useState<boolean | null>(
    null
  );

  const refresh = useCallback(async () => {
    try {
      const val = await invoke<boolean>("is_default_browser");
      setIsDefaultBrowser(val);
    } catch (error) {
      console.error("[Hook] is_default_browser error:", error);
    }
  }, []);

  useEffect(() => {
    // Initial check
    refresh().catch((err) => console.error("[Hook] refresh error:", err));

    const onVis = () => {
      if (!document.hidden) {
        refresh().catch((err) => console.error("[Hook] refresh error:", err));
      }
    };
    document.addEventListener("visibilitychange", onVis);

    let interval: number | null = null;
    if (pollMs > 0) {
      interval = window.setInterval(() => {
        refresh().catch((err) => console.error("[Hook] refresh error:", err));
      }, pollMs);
    }

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }, [refresh, pollMs]);

  return { isDefaultBrowser, refresh } as const;
}
