import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Tab } from "../types";

const getPrimaryFavicon = (url: string): string | null => {
  try {
    const u = new URL(url);
    return new URL("/favicon.ico", `${u.protocol}//${u.host}`).toString();
  } catch {
    return null;
  }
};

const getFallbackFavicon = (url: string): string | null => {
  try {
    const u = new URL(url);
    const host = u.hostname;
    return `https://www.google.com/s2/favicons?sz=32&domain=${host}`;
  } catch {
    return null;
  }
};

interface FaviconProps {
  url: string;
  title: string;
}

function Favicon({ url, title }: FaviconProps) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const primary = getPrimaryFavicon(url);
    const fallback = getFallbackFavicon(url);

    const candidates = [primary, fallback].filter((s): s is string =>
      Boolean(s)
    );

    if (candidates.length === 0) {
      setSrc(null);
      return () => {
        cancelled = true;
      };
    }

    const load = (u: string) =>
      new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(u);
        img.onerror = reject;
        img.src = u;
      });

    Promise.any(candidates.map((c) => load(c)))
      .then((winner) => {
        if (!cancelled) {
          setSrc(winner);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!src) {
    return null;
  }

  return (
    <span
      aria-hidden="true"
      className="mr-2 inline-block h-4 w-4 rounded-sm bg-center bg-no-repeat"
      style={{ backgroundImage: `url("${src}")`, backgroundSize: "contain" }}
      title={`${title || "Tab"} favicon`}
    />
  );
}

interface TabStripProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onNewTab: () => void;
}

export function TabStrip({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
}: TabStripProps) {
  return (
    <div className="flex shrink-0 items-center overflow-x-auto border-b px-2 py-1">
      <div className="flex items-center space-x-1">
        {tabs.map((tab) => (
          <div
            className={`flex cursor-pointer items-center rounded-t-lg px-3 py-1.5 ${
              tab.id === activeTabId
                ? "border-t border-r border-l bg-card/70 font-semibold"
                : "border border-transparent bg-card/30 hover:bg-card/50"
            }min-w-[120px] max-w-[200px]`}
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                onTabClick(tab.id);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <Favicon title={tab.title} url={tab.url} />
            <span className="flex-1 truncate text-sm">
              {tab.title || "New Tab"}
            </span>
            <Button
              className="ml-2 h-auto p-0.5"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              size="icon"
              type="button"
              variant="ghost"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ))}
        <Button onClick={onNewTab} size="icon" type="button" variant="ghost">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
