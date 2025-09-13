import { invoke } from "@tauri-apps/api/core";
import { useEffect, useRef } from "react";
import type { Tab } from "../types";

interface WebviewContainerProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabUpdate?: (tabId: string, updates: Partial<Tab>) => void;
}

export function WebviewContainer({ tabs, activeTabId }: WebviewContainerProps) {
  const createdWebviewsRef = useRef<Set<string>>(new Set());
  const urlRef = useRef<Map<string, string>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const labelByTabIdRef = useRef<Map<string, string>>(new Map());
  const visibleTabIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: tracked in issue to refactor; kept for minimal changes
    const createOrUpdateWebviews = async () => {
      const rect = containerRef.current?.getBoundingClientRect();

      console.log("[WebviewContainer] Container dimensions:", {
        width: rect?.width,
        height: rect?.height,
        left: rect?.left,
        top: rect?.top,
      });

      // wait for layout before creating anything
      if (!rect || rect.width < 2 || rect.height < 2) {
        console.log("[WebviewContainer] Container too small, retrying...");
        requestAnimationFrame(createOrUpdateWebviews);
        return;
      }

      for (const tab of tabs) {
        const existing = createdWebviewsRef.current.has(tab.id);

        // Don't recreate if URL changed - navigation is handled elsewhere
        // This preserves browser history
        const lastUrl = urlRef.current.get(tab.id);
        const urlChanged = lastUrl && lastUrl !== tab.url;
        if (existing && urlChanged) {
          // Just update our tracking, don't recreate the webview
          urlRef.current.set(tab.id, tab.url);
          continue;
        }

        if (!createdWebviewsRef.current.has(tab.id)) {
          try {
            // Use logical CSS pixels directly (Tauri expects logical units)
            const logicalX = Math.round(rect.left);
            const logicalY = Math.round(rect.top);
            const logicalWidth = Math.round(rect.width);
            const logicalHeight = Math.round(rect.height);

            console.log(
              `[WebviewContainer] Creating webview ${tab.webviewLabel} with dimensions:`,
              {
                x: logicalX,
                y: logicalY,
                width: logicalWidth,
                height: logicalHeight,
                url: tab.url,
              }
            );

            // Create the webview with logical coordinates
            await invoke("create_browser_webview", {
              label: tab.webviewLabel,
              url: tab.url,
              x: logicalX,
              y: logicalY,
              width: logicalWidth,
              height: logicalHeight,
            });

            console.log(
              `[WebviewContainer] Webview ${tab.webviewLabel} created successfully`
            );
            createdWebviewsRef.current.add(tab.id);
            urlRef.current.set(tab.id, tab.url);
            labelByTabIdRef.current.set(tab.id, tab.webviewLabel);

            // Handle visibility deterministically: only active tab is visible
            if (tab.id === activeTabId) {
              await invoke("show_webview", { label: tab.webviewLabel });
              visibleTabIdsRef.current.add(tab.id);
              console.log(
                `[WebviewContainer] Showed webview ${tab.webviewLabel}`
              );
            } else {
              await invoke("hide_webview", { label: tab.webviewLabel });
              visibleTabIdsRef.current.delete(tab.id);
              console.log(`[WebviewContainer] Hid webview ${tab.webviewLabel}`);
            }
          } catch (error) {
            console.error(
              `[WebviewContainer] Failed to create webview for tab ${tab.id}:`,
              error
            );
          }
        }
      }

      // Clean up stray webviews + enforce visibility when active tab changes
      for (const tabId of createdWebviewsRef.current) {
        const tab = tabs.find((t) => t.id === tabId);
        if (!tab) {
          const label = labelByTabIdRef.current.get(tabId);
          if (label) {
            await invoke("close_webview", { label }).catch(console.error);
          }
          createdWebviewsRef.current.delete(tabId);
          urlRef.current.delete(tabId);
          labelByTabIdRef.current.delete(tabId);
        } else if (tabId === activeTabId) {
          if (!visibleTabIdsRef.current.has(tabId)) {
            await invoke("show_webview", { label: tab.webviewLabel });
            visibleTabIdsRef.current.add(tabId);
          }
        } else if (visibleTabIdsRef.current.has(tabId)) {
          await invoke("hide_webview", { label: tab.webviewLabel });
          visibleTabIdsRef.current.delete(tabId);
        }
      }
    };

    createOrUpdateWebviews();
  }, [tabs, activeTabId]);

  // Handle resizing of webviews when the container changes
  useEffect(() => {
    let raf = 0;

    const updateActiveBounds = async () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width < 2 || rect.height < 2) {
        return;
      }

      const logicalX = Math.round(rect.left);
      const logicalY = Math.round(rect.top);
      const logicalWidth = Math.round(rect.width);
      const logicalHeight = Math.round(rect.height);

      const active = tabs.find((t) => t.id === activeTabId);
      if (!active) {
        return;
      }
      if (!createdWebviewsRef.current.has(active.id)) {
        return;
      }

      try {
        await invoke("update_webview_bounds", {
          label: active.webviewLabel,
          x: logicalX,
          y: logicalY,
          width: logicalWidth,
          height: logicalHeight,
        });
      } catch (e) {
        console.error(
          `[WebviewContainer] Failed to update bounds for ${active.webviewLabel}:`,
          e
        );
      }
    };

    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // Intentionally not awaited; rAF callback
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        updateActiveBounds();
      });
    };

    const resizeObserver = new ResizeObserver(() => schedule());
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    const onWindow = () => schedule();
    window.addEventListener("resize", onWindow);

    // Run once on mount / dependency change
    schedule();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onWindow);
      resizeObserver.disconnect();
    };
  }, [tabs, activeTabId]);

  return (
    <div className="relative flex-1 bg-transparent" ref={containerRef}>
      {tabs.length === 0 && (
        <div className="flex h-full items-center justify-center text-gray-500">
          Click + to create a new tab
        </div>
      )}
    </div>
  );
}
