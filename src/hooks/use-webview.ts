import { Webview } from "@tauri-apps/api/webview";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef } from "react";

interface UseWebviewOptions {
  url: string;
  label: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export function useWebview({
  url,
  label,
  x = 0,
  y = 48,
  width = 1280,
  height = 720,
}: UseWebviewOptions) {
  const webviewRef = useRef<Webview | null>(null);

  useEffect(() => {
    let webview: Webview | null = null;

    const createWebview = async () => {
      try {
        const mainWindow = getCurrentWindow();
        webview = new Webview(mainWindow, label, {
          url,
          x,
          y,
          width,
          height,
          transparent: false,
        });

        await webview.once("tauri://created", () => {
          console.log(`Webview ${label} created`);
        });

        await webview.once("tauri://error", (e) => {
          console.error(`Webview ${label} error:`, e);
        });

        webviewRef.current = webview;
      } catch (error) {
        console.error("Failed to create webview:", error);
      }
    };

    createWebview();

    return () => {
      if (webview) {
        webview.close().catch(console.error);
      }
    };
  }, [url, label, x, y, width, height]);

  return webviewRef.current;
}
