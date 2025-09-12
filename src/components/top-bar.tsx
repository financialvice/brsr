import type React from "react";
import { useEffect, useState } from "react";

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

  return (
    <div className="flex h-12 items-center space-x-2 border-gray-200 border-b bg-gray-50 px-3">
      <button
        className={`rounded p-1.5 ${
          canGoBack
            ? "cursor-pointer text-gray-700 hover:bg-gray-200"
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
        className={`rounded p-1.5 ${
          canGoForward
            ? "cursor-pointer text-gray-700 hover:bg-gray-200"
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
        className="rounded p-1.5 text-gray-700 hover:bg-gray-200"
        onClick={onReload}
        title="Reload"
        type="button"
      >
        ↻
      </button>

      <form className="flex-1" onSubmit={handleSubmit}>
        <input
          className="w-full rounded-md border border-gray-300 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Enter URL..."
          type="text"
          value={urlInput}
        />
      </form>
    </div>
  );
}
