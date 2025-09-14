import { listen } from "@tauri-apps/api/event";
import { useEffect, useMemo, useState } from "react";

type TelemetryEvent =
  | {
      label: string;
      ts: number;
      kind: "init" | "heartbeat";
      title?: string;
      url?: string;
    }
  | {
      label: string;
      ts: number;
      kind: "page-info";
      title: string;
      url: string;
      lang: string | null;
      metas: Record<string, string>;
      icons: string[];
      themeColor: string | null;
      links: Array<{ href: string; text: string }>;
      headings: Array<{ tag: string; text: string }>;
    }
  | { label: string; ts: number; kind: "selection"; text: string }
  | {
      label: string;
      ts: number;
      kind: "resource";
      item: {
        type: string;
        name: string;
        duration: number;
        startTime: number;
        transferSize: number;
      };
    }
  | {
      label: string;
      ts: number;
      kind: "fetch";
      url: string;
      method: string;
      status: number;
      duration: number;
      preview: string | null;
    }
  | {
      label: string;
      ts: number;
      kind: "fetch-error";
      url: string;
      method: string;
      error: string;
      duration: number;
    }
  | {
      label: string;
      ts: number;
      kind: "xhr";
      url: string;
      method: string;
      status: number;
      duration: number;
    }
  | {
      label: string;
      ts: number;
      kind: "console";
      level: "log" | "info" | "warn" | "error";
      message: string;
    }
  | {
      label: string;
      ts: number;
      kind: "error";
      message: string;
      source: string | null;
      lineno: number | null;
      colno: number | null;
    }
  | { label: string; ts: number; kind: "unhandledrejection"; reason: string }
  | {
      label: string;
      ts: number;
      kind: "paint";
      name: string;
      startTime: number;
    }
  | {
      label: string;
      ts: number;
      kind: "lcp";
      startTime: number;
      size: number;
      url: string | null;
    }
  | {
      label: string;
      ts: number;
      kind: "longtask";
      startTime: number;
      duration: number;
    }
  | {
      label: string;
      ts: number;
      kind: "navigation";
      domContentLoaded: number;
      loadEventEnd: number;
      type: string;
    };

type PanelState = {
  pageTitle: string;
  pageUrl: string;
  metas: Record<string, string>;
  selection: string | null;
  requests: Array<{
    id: string;
    type: string;
    url: string;
    status?: number | null;
    duration?: number | null;
    method?: string | null;
  }>;
  logs: Array<{
    id: string;
    level: "log" | "info" | "warn" | "error";
    message: string;
  }>;
  errors: Array<{ id: string; message: string }>; // includes unhandled rejections
};

const MAX = 30 as const;

function initialPanelState(): PanelState {
  return {
    pageTitle: "",
    pageUrl: "",
    metas: {},
    selection: null,
    requests: [],
    logs: [],
    errors: [],
  };
}

function reduceEvent(cur: PanelState, payload: TelemetryEvent): PanelState {
  const next: PanelState = { ...cur };
  const id = `${payload.kind}-${payload.ts}`;
  switch (payload.kind) {
    case "page-info": {
      next.pageTitle = payload.title;
      next.pageUrl = payload.url;
      next.metas = payload.metas;
      break;
    }
    case "heartbeat": {
      if (payload.title) {
        next.pageTitle = payload.title;
      }
      if (payload.url) {
        next.pageUrl = payload.url;
      }
      break;
    }
    case "selection": {
      next.selection = payload.text;
      break;
    }
    case "resource": {
      const { item } = payload;
      next.requests = [
        ...next.requests,
        { id, type: item.type, url: item.name, duration: item.duration },
      ].slice(-MAX);
      break;
    }
    case "fetch": {
      next.requests = [
        ...next.requests,
        {
          id,
          type: "fetch",
          url: payload.url,
          status: payload.status,
          duration: payload.duration,
          method: payload.method,
        },
      ].slice(-MAX);
      break;
    }
    case "fetch-error": {
      next.requests = [
        ...next.requests,
        {
          id,
          type: "fetch-error",
          url: payload.url,
          duration: payload.duration,
          method: payload.method,
          status: null,
        },
      ].slice(-MAX);
      next.errors = [...next.errors, { id, message: payload.error }].slice(
        -MAX
      );
      break;
    }
    case "xhr": {
      next.requests = [
        ...next.requests,
        {
          id,
          type: "xhr",
          url: payload.url,
          status: payload.status,
          duration: payload.duration,
          method: payload.method,
        },
      ].slice(-MAX);
      break;
    }
    case "console": {
      next.logs = [
        ...next.logs,
        { id, level: payload.level, message: payload.message },
      ].slice(-MAX);
      break;
    }
    case "error": {
      next.errors = [
        ...next.errors,
        {
          id,
          message: `${payload.message}${payload.source ? ` @ ${payload.source}` : ""}`,
        },
      ].slice(-MAX);
      break;
    }
    case "unhandledrejection": {
      next.errors = [...next.errors, { id, message: payload.reason }].slice(
        -MAX
      );
      break;
    }
    default: {
      // ignore
    }
  }
  return next;
}

export function AssistantPanel({
  activeWebviewLabel,
}: {
  activeWebviewLabel: string | null;
}) {
  const [byLabel, setByLabel] = useState<Record<string, PanelState>>({});

  useEffect(() => {
    const unlisten = listen<TelemetryEvent>("webview-telemetry", (event) => {
      const payload = event.payload;
      const label = payload.label;
      setByLabel((prev) => ({
        ...prev,
        [label]: reduceEvent(prev[label] ?? initialPanelState(), payload),
      }));
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const state = useMemo<PanelState | null>(() => {
    if (!activeWebviewLabel) {
      return null;
    }
    return byLabel[activeWebviewLabel] ?? null;
  }, [byLabel, activeWebviewLabel]);

  return (
    <aside className="flex w-[320px] min-w-[320px] flex-col border-l p-0">
      <div className="shrink-0 border-b p-3">
        <h2 className="font-semibold text-lg">Assistant</h2>
      </div>
      <div className="max-h-100 flex-1 overflow-y-auto p-4">
        {!activeWebviewLabel && (
          <div className="text-muted-foreground text-sm">
            Open a tab to see page insights.
          </div>
        )}
        {activeWebviewLabel && !state && (
          <div className="text-muted-foreground text-sm">
            Waiting for telemetry…
          </div>
        )}
        {state && (
          <div className="space-y-4">
            <section>
              <div className="text-muted-foreground text-sm">Page</div>
              <div className="truncate font-medium">
                {state.pageTitle || "(no title)"}
              </div>
              <div
                className="truncate text-muted-foreground text-xs"
                title={state.pageUrl}
              >
                {state.pageUrl || ""}
              </div>
              {Boolean(state.metas.description) && (
                <p className="mt-2 line-clamp-4 text-muted-foreground text-sm">
                  {state.metas.description}
                </p>
              )}
            </section>

            {state.selection && (
              <section>
                <div className="text-muted-foreground text-sm">Selection</div>
                <blockquote className="mt-1 rounded bg-muted p-2 text-sm">
                  {state.selection}
                </blockquote>
              </section>
            )}

            <section>
              <div className="mb-1 text-muted-foreground text-sm">
                Network (latest)
              </div>
              <ul className="space-y-1">
                {state.requests
                  .slice(-8)
                  .reverse()
                  .map((r) => (
                    <li className="text-xs" key={r.id}>
                      <span className="font-medium">
                        {r.type.toUpperCase()}
                      </span>
                      <span className="text-muted-foreground">
                        {" "}
                        {r.method ? `${r.method} ` : ""}
                      </span>
                      <span className="truncate">{r.url}</span>
                      {typeof r.status === "number" && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {r.status}
                        </span>
                      )}
                      {typeof r.duration === "number" && (
                        <span className="text-muted-foreground">
                          {" "}
                          · {Math.round(r.duration)}ms
                        </span>
                      )}
                    </li>
                  ))}
                {state.requests.length === 0 && (
                  <li className="text-muted-foreground text-xs">
                    No requests observed yet.
                  </li>
                )}
              </ul>
            </section>

            <section>
              <div className="mb-1 text-muted-foreground text-sm">Console</div>
              <ul className="space-y-1">
                {state.logs
                  .slice(-6)
                  .reverse()
                  .map((l) => (
                    <li className="text-xs" key={l.id}>
                      <span
                        className={
                          l.level === "error" || l.level === "warn"
                            ? "text-destructive"
                            : "text-foreground"
                        }
                      >
                        {l.level}
                      </span>
                      <span> · {l.message}</span>
                    </li>
                  ))}
                {state.logs.length === 0 && (
                  <li className="text-muted-foreground text-xs">
                    No logs yet.
                  </li>
                )}
              </ul>
            </section>

            {state.errors.length > 0 && (
              <section>
                <div className="mb-1 text-muted-foreground text-sm">Errors</div>
                <ul className="space-y-1">
                  {state.errors
                    .slice(-6)
                    .reverse()
                    .map((e) => (
                      <li className="text-destructive text-xs" key={e.id}>
                        {e.message}
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
