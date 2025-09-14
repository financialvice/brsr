import { relaunch } from "@tauri-apps/plugin-process";
import {
  check,
  type DownloadEvent,
  type Update as UpdaterUpdate,
} from "@tauri-apps/plugin-updater";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

type BannerState =
  | { kind: "idle" }
  | { kind: "available"; update: UpdaterUpdate }
  | {
      kind: "installing";
      version: string;
      downloaded: number;
      total: number | null;
    }
  | { kind: "error"; message: string };

const DISMISS_KEY = "dismissed-update-version";

function getDismissedVersion(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}

function setDismissedVersion(v: string) {
  try {
    localStorage.setItem(DISMISS_KEY, v);
  } catch {
    // ignore
  }
}

export function UpdateBanner() {
  const [state, setState] = useState<BannerState>({ kind: "idle" });
  const startedRef = useRef(false);

  // one-shot check on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await check();
        if (!res || cancelled) {
          return;
        }

        // Skip if user dismissed this version previously.
        const dismissed = getDismissedVersion();
        if (dismissed && dismissed === res.version) {
          return;
        }

        setState({ kind: "available", update: res });
      } catch (err) {
        // Do not surface errors at startup – keep the UI quiet by default.
        console.error("[Updater] check() failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const percent = useMemo(() => {
    if (state.kind !== "installing") {
      return null;
    }
    if (!state.total || state.total <= 0) {
      return null;
    }
    return Math.floor((state.downloaded / state.total) * 100);
  }, [state]);

  if (state.kind === "idle") {
    return null;
  }

  if (state.kind === "available") {
    const v = state.update.version;
    return (
      <Alert className="rounded-none border-x-0 border-t-0">
        <AlertTitle>Update available</AlertTitle>
        <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm">
            A new version <span className="font-medium">{v}</span> is available.
          </span>
          <div className="flex items-center gap-2">
            <Button
              onClick={async () => {
                if (startedRef.current) {
                  return;
                }
                startedRef.current = true;
                setState({
                  kind: "installing",
                  version: v,
                  downloaded: 0,
                  total: null,
                });

                try {
                  await state.update.downloadAndInstall((ev: DownloadEvent) => {
                    switch (ev.event) {
                      case "Started":
                        setState((s) =>
                          s.kind === "installing"
                            ? { ...s, total: ev.data.contentLength ?? null }
                            : s
                        );
                        break;
                      case "Progress":
                        setState((s) =>
                          s.kind === "installing"
                            ? {
                                ...s,
                                downloaded: s.downloaded + ev.data.chunkLength,
                              }
                            : s
                        );
                        break;
                      case "Finished":
                        // no-op: we'll relaunch below
                        break;
                      default:
                        // Ignore other event types
                        break;
                    }
                  });

                  // On Windows the installer may close the app automatically.
                  // Calling relaunch() is still safe on other platforms.
                  try {
                    await relaunch();
                  } catch (e) {
                    console.warn(
                      "[Updater] relaunch() failed (likely Windows auto-exit):",
                      e
                    );
                  }
                } catch (e) {
                  console.error("[Updater] downloadAndInstall failed:", e);
                  setState({
                    kind: "error",
                    message: e instanceof Error ? e.message : String(e),
                  });
                  startedRef.current = false;
                }
              }}
              type="button"
              variant="default"
            >
              Update now
            </Button>
            <Button
              onClick={() => {
                setDismissedVersion(v);
                setState({ kind: "idle" });
              }}
              type="button"
              variant="outline"
            >
              Dismiss
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (state.kind === "installing") {
    return (
      <Alert className="rounded-none border-x-0 border-t-0">
        <AlertTitle>Installing update…</AlertTitle>
        <AlertDescription>
          <div className="mt-2 flex items-center gap-3">
            <Progress aria-label="Download progress" value={percent ?? 0} />
            <span className="min-w-[48px] text-right text-xs tabular-nums">
              {percent === null ? "…" : `${percent}%`}
            </span>
          </div>
          <p className="mt-2 text-muted-foreground text-xs">
            The app will restart when installation completes.
          </p>
        </AlertDescription>
      </Alert>
    );
  }

  // error
  return (
    <Alert className="rounded-none border-x-0 border-t-0">
      <AlertTitle>Update failed</AlertTitle>
      <AlertDescription className="flex items-center justify-between gap-2">
        <span className="text-sm">{state.message}</span>
        <Button
          onClick={() => setState({ kind: "idle" })}
          title="Dismiss"
          type="button"
          variant="outline"
        >
          Close
        </Button>
      </AlertDescription>
    </Alert>
  );
}
