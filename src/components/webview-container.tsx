import { cn } from "@/lib/utils";
import type { Tab } from "../types";
import { WebviewSlot } from "./webview-slot";

interface WebviewContainerProps {
  tabs: Tab[];
  activeTabId: string | null;
  className?: string;
}

export function WebviewContainer({
  tabs,
  activeTabId,
  className,
}: WebviewContainerProps) {
  return (
    <div
      className={cn(
        "relative flex-1 overflow-hidden bg-transparent",
        className
      )}
    >
      {tabs.length === 0 && (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Click + to create a new tab
        </div>
      )}

      <div className="h-full w-full">
        {tabs.map((tab) => (
          <WebviewSlot
            className={cn(
              "h-full w-full",
              tab.id === activeTabId ? "block" : "hidden"
            )}
            key={tab.id}
            label={tab.webviewLabel}
            url={tab.url}
            visible={tab.id === activeTabId}
          />
        ))}
      </div>
    </div>
  );
}
