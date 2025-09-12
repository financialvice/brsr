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

  useEffect(() => {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: FIX SOON
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
            // Get the device pixel ratio for proper scaling
            const dpr = window.devicePixelRatio || 1;

            // The positions need to be in physical pixels for the Rust side
            // which will convert them back to logical pixels
            // Add a small offset to ensure we don't cover the tab bar
            const TAB_BAR_OFFSET = 50; // Additional pixels to push down
            const physicalX = Math.round(rect.left * dpr);
            const physicalY = Math.round((rect.top + TAB_BAR_OFFSET) * dpr);
            const physicalWidth = Math.round(rect.width * dpr);
            const physicalHeight = Math.round(
              (rect.height - TAB_BAR_OFFSET) * dpr
            );

            console.log(
              `[WebviewContainer] Creating webview ${tab.webviewLabel} with dimensions:`,
              {
                logical: {
                  x: rect.left,
                  y: rect.top,
                  width: rect.width,
                  height: rect.height,
                },
                physical: {
                  x: physicalX,
                  y: physicalY,
                  width: physicalWidth,
                  height: physicalHeight,
                },
                dpr,
                url: tab.url,
              }
            );

            // Use the Rust command to create the webview
            // Pass physical pixel values since Rust will convert to logical
            await invoke("create_browser_webview", {
              label: tab.webviewLabel,
              url: tab.url,
              x: physicalX,
              y: physicalY,
              width: physicalWidth,
              height: physicalHeight,
            });

            console.log(
              `[WebviewContainer] Webview ${tab.webviewLabel} created successfully`
            );
            createdWebviewsRef.current.add(tab.id);
            urlRef.current.set(tab.id, tab.url);

            // Handle visibility
            if (tab.id === activeTabId) {
              await invoke("show_webview", { label: tab.webviewLabel });
              console.log(
                `[WebviewContainer] Showed webview ${tab.webviewLabel}`
              );
            } else {
              await invoke("hide_webview", { label: tab.webviewLabel });
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

      // Clean up stray webviews + enforce visibility in case of tab changes
      for (const tabId of createdWebviewsRef.current) {
        const tab = tabs.find((t) => t.id === tabId);
        if (!tab) {
          const oldTab = Array.from(urlRef.current.entries()).find(
            ([id]) => id === tabId
          );
          if (oldTab) {
            await invoke("close_webview", {
              label: `webview-${tabId.replace("tab-", "")}`,
            }).catch(console.error);
          }
          createdWebviewsRef.current.delete(tabId);
          urlRef.current.delete(tabId);
        } else if (tabId === activeTabId) {
          await invoke("show_webview", { label: tab.webviewLabel });
        } else {
          await invoke("hide_webview", { label: tab.webviewLabel });
        }
      }
    };

    createOrUpdateWebviews();
  }, [tabs, activeTabId]);

  // Handle resizing of webviews when the container changes
  useEffect(() => {
    // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: FIX SOON
    const updateWebviewBounds = async () => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || rect.width < 2 || rect.height < 2) {
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const TAB_BAR_OFFSET = 50; // Same offset as in creation
      const physicalX = Math.round(rect.left * dpr);
      const physicalY = Math.round((rect.top + TAB_BAR_OFFSET) * dpr);
      const physicalWidth = Math.round(rect.width * dpr);
      const physicalHeight = Math.round((rect.height - TAB_BAR_OFFSET) * dpr);

      // Update bounds for all created webviews
      for (const tab of tabs) {
        if (createdWebviewsRef.current.has(tab.id)) {
          try {
            await invoke("update_webview_bounds", {
              label: tab.webviewLabel,
              x: physicalX,
              y: physicalY,
              width: physicalWidth,
              height: physicalHeight,
            });
          } catch (e) {
            console.error(
              `[WebviewContainer] Failed to update bounds for ${tab.webviewLabel}:`,
              e
            );
          }
        }
      }
    };

    // Update on window resize
    const handleResize = () => {
      updateWebviewBounds();
    };

    window.addEventListener("resize", handleResize);

    // Also update when container size changes
    const resizeObserver = new ResizeObserver(() => {
      updateWebviewBounds();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      resizeObserver.disconnect();
    };
  }, [tabs]);

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
