import type React from "react";
import { useEffect, useState } from "react";
import { useIsMac } from "../hooks/use-is-mac";

interface TopBarProps {
  currentUrl: string;
  onNavigate: (url: string) => void;
  onBack: () => void;
  onForward: () => void;
  onReload: () => void;
  canGoBack?: boolean;
  canGoForward?: boolean;
}

export function TopBar({
  currentUrl,
  onNavigate,
  onBack,
  onForward,
  onReload,
  canGoBack = false,
  canGoForward = false,
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
      className={`drag relative flex h-12 items-center space-x-2 border-gray-200 border-b px-3 ${leftPadding}`}
      data-tauri-drag-region
    >
      {/* Left drag spacer (empty background only) */}
      <div aria-hidden className="h-8 w-2" data-tauri-drag-region />
      <button
        className={`no-drag rounded p-1.5 ${
          canGoBack
            ? "cursor-pointer text-gray-700 hover:bg-gray-200/50"
            : "cursor-not-allowed text-gray-400"
        }`}
        disabled={!canGoBack}
        onClick={onBack}
        title="Back"
        type="button"
      >
        ←
      </button>
      <button
        className={`no-drag rounded p-1.5 ${
          canGoForward
            ? "cursor-pointer text-gray-700 hover:bg-gray-200/50"
            : "cursor-not-allowed text-gray-400"
        }`}
        disabled={!canGoForward}
        onClick={onForward}
        title="Forward"
        type="button"
      >
        →
      </button>
      <button
        className="no-drag rounded p-1.5 text-gray-700 hover:bg-gray-200/50"
        onClick={onReload}
        title="Reload"
        type="button"
      >
        ↻
      </button>

      <form className="no-drag flex-1" onSubmit={handleSubmit}>
        <input
          className="w-full rounded-md border border-gray-300 bg-white/50 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Enter URL..."
          type="text"
          value={urlInput}
        />
      </form>

      {/* Right drag spacer for grabbing the window when not interacting */}
      <div aria-hidden className="h-8 w-20" data-tauri-drag-region />
    </div>
  );
}
