import { ArrowLeft, ArrowRight, RotateCw } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useIsMac } from "../hooks/use-is-mac";

interface TopBarProps {
  currentUrl: string;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
  onMakeDefaultBrowser?: () => void | Promise<void>;
}

export function TopBar({
  currentUrl,
  onNavigate,
  onBack,
  onForward,
  onReload,
  canGoBack = false,
  canGoForward = false,
  onMakeDefaultBrowser,
}: TopBarProps) {
  const [urlInput, setUrlInput] = useState(currentUrl);
  const isMac = useIsMac();

  useEffect(() => {
    setUrlInput(currentUrl);
  }, [currentUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let url = urlInput.trim();
    if (!(url.startsWith("http://") || url.startsWith("https://"))) {
      url = `https://${url}`;
    }
    onNavigate(url);
  };

  // Inline layout with macOS traffic lights on the left, but avoid
  // placing interactive elements inside a drag region. Use dedicated
  // empty drag spacers instead of applying a drag region to the whole row.
  const leftPadding = isMac ? "pl-16" : ""; // visual offset for traffic lights

  return (
    <div
      className={`relative flex h-12 shrink-0 items-center space-x-2 border-b px-3 ${leftPadding}`}
      data-tauri-drag-region
    >
      {/* Left drag spacer (empty background only) */}
      <div aria-hidden className="drag h-8 w-2" data-tauri-drag-region />
      <Button
        className="no-drag"
        disabled={!canGoBack}
        onClick={onBack}
        size="icon"
        title="Back"
        type="button"
        variant="ghost"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <Button
        className="no-drag"
        disabled={!canGoForward}
        onClick={onForward}
        size="icon"
        title="Forward"
        type="button"
        variant="ghost"
      >
        <ArrowRight className="h-4 w-4" />
      </Button>
      <Button
        className="no-drag"
        onClick={onReload}
        size="icon"
        title="Reload"
        type="button"
        variant="ghost"
      >
        <RotateCw className="h-4 w-4" />
      </Button>

      <form className="no-drag flex-1" onSubmit={handleSubmit}>
        <Input
          className="no-drag bg-background/50"
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Enter URL..."
          type="text"
          value={urlInput}
        />
      </form>

      {onMakeDefaultBrowser && (
        <Button
          className="no-drag"
          onClick={async () => {
            // Extra logging helps when drag regions swallow clicks on macOS overlays
            console.log("[UI] Make Default clicked");
            try {
              await onMakeDefaultBrowser();
            } catch (err) {
              console.error("[UI] Make Default handler error:", err);
            }
          }}
          title="Set brsr as default browser"
          type="button"
          variant="outline"
        >
          Make Default
        </Button>
      )}

      {/* Right drag spacer for grabbing the window when not interacting */}
      <div aria-hidden className="drag h-8 w-20" data-tauri-drag-region />
    </div>
  );
}
