import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useState } from "react";
import { AssistantPanel } from "./components/assistant-panel";
import { TabStrip } from "./components/tab-strip";
import { TopBar } from "./components/top-bar";
import { WebviewContainer } from "./components/webview-container";
import type { BrowserState, Tab } from "./types";

function App() {
  const [state, setState] = useState<BrowserState>({
    tabs: [],
    activeTabId: null,
  });
  const [navState, setNavState] = useState({
    canGoBack: false,
    canGoForward: false,
  });

  // Using JS-side webview plugin now; no manual registry required

  const createNewTab = useCallback(() => {
    const timestamp = Date.now();
    const newTab: Tab = {
      id: `tab-${timestamp}`,
      title: "New Tab",
      url: "https://www.google.com",
      active: true,
      webviewLabel: `webview-${timestamp}`,
      history: ["https://www.google.com"],
      historyIndex: 0,
    };

    console.log("[Frontend] Creating new tab:", newTab);

    setState((prev) => {
      const newState = {
        tabs: [...prev.tabs, newTab],
        activeTabId: newTab.id,
      };
      console.log("[Frontend] New state after tab creation:", newState);
      return newState;
    });
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setState((prev) => {
      const tabIndex = prev.tabs.findIndex((t) => t.id === tabId);
      const newTabs = prev.tabs.filter((t) => t.id !== tabId);

      let newActiveId = prev.activeTabId;
      if (prev.activeTabId === tabId) {
        if (newTabs.length > 0) {
          const newIndex = Math.min(tabIndex, newTabs.length - 1);
          newActiveId = newTabs[newIndex].id;
        } else {
          newActiveId = null;
        }
      }

      return {
        tabs: newTabs,
        activeTabId: newActiveId,
      };
    });
  }, []);

  const selectTab = useCallback((tabId: string) => {
    console.log("[Frontend] Selecting tab:", tabId);
    setState((prev) => ({
      ...prev,
      activeTabId: tabId,
    }));
  }, []);

  const updateTab = useCallback((tabId: string, updates: Partial<Tab>) => {
    setState((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab) =>
        tab.id === tabId ? { ...tab, ...updates } : tab
      ),
    }));
  }, []);

  const navigateActiveTab = useCallback(
    async (url: string) => {
      const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
      if (!activeTab) {
        return;
      }

      try {
        // Navigate the existing webview to the new URL
        await invoke("navigate_webview", {
          label: activeTab.webviewLabel,
          url,
        });

        // Update the tab's URL and history
        const history = activeTab.history || [activeTab.url];
        const historyIndex = activeTab.historyIndex ?? 0;

        // When navigating to a new URL, clear forward history and add new entry
        const newHistory = [...history.slice(0, historyIndex + 1), url];

        updateTab(activeTab.id, {
          url,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        });
      } catch (error) {
        console.error("Navigation failed:", error);
      }
    },
    [state.tabs, state.activeTabId, updateTab]
  );

  const handleBack = useCallback(async () => {
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!activeTab) {
      return;
    }

    const historyIndex = activeTab.historyIndex ?? 0;
    if (historyIndex > 0) {
      try {
        await invoke("navigate_back_webview", {
          label: activeTab.webviewLabel,
        });
        console.log(
          "[Frontend] Navigated back in webview:",
          activeTab.webviewLabel
        );

        // Update history index
        updateTab(activeTab.id, {
          historyIndex: historyIndex - 1,
          url: activeTab.history?.[historyIndex - 1] || activeTab.url,
        });
      } catch (error) {
        console.error("Back navigation failed:", error);
      }
    }
  }, [state.tabs, state.activeTabId, updateTab]);

  const handleForward = useCallback(async () => {
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!activeTab) {
      return;
    }

    const history = activeTab.history || [];
    const historyIndex = activeTab.historyIndex ?? 0;

    if (historyIndex < history.length - 1) {
      try {
        await invoke("navigate_forward_webview", {
          label: activeTab.webviewLabel,
        });
        console.log(
          "[Frontend] Navigated forward in webview:",
          activeTab.webviewLabel
        );

        // Update history index
        updateTab(activeTab.id, {
          historyIndex: historyIndex + 1,
          url: history[historyIndex + 1],
        });
      } catch (error) {
        console.error("Forward navigation failed:", error);
      }
    }
  }, [state.tabs, state.activeTabId, updateTab]);

  const handleReload = useCallback(async () => {
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!activeTab) {
      return;
    }

    try {
      await invoke("refresh_webview", { label: activeTab.webviewLabel });
      console.log("[Frontend] Refreshed webview:", activeTab.webviewLabel);
    } catch (error) {
      console.error("Reload failed:", error);
    }
  }, [state.tabs, state.activeTabId]);

  const activeTab = state.tabs.find((t) => t.id === state.activeTabId);

  // Listen for webview navigation events
  useEffect(() => {
    const unlisten = listen<{ label: string; url: string }>(
      "webview-navigated",
      (event) => {
        console.log("[Frontend] Webview navigation event:", event.payload);
        const { label, url } = event.payload;

        // Find the tab with this webview label and update its URL
        setState((prev) => ({
          ...prev,
          tabs: prev.tabs.map((tab) => {
            if (tab.webviewLabel === label && tab.url !== url) {
              // Only update if URL actually changed
              console.log(
                `[Frontend] Updating tab ${tab.id} URL from ${tab.url} to ${url}`
              );

              const history = tab.history || [tab.url];
              const historyIndex = tab.historyIndex ?? 0;

              // Check if this is a back/forward navigation or a new navigation
              // If the URL exists in history near our current position, it's likely back/forward
              const existingIndex = history.indexOf(url);

              if (
                existingIndex !== -1 &&
                Math.abs(existingIndex - historyIndex) <= 1
              ) {
                // This is likely a back/forward navigation
                return {
                  ...tab,
                  url,
                  historyIndex: existingIndex,
                };
              }
              // This is a new navigation (e.g., clicking a link)
              // Clear forward history and add new entry
              const newHistory = [...history.slice(0, historyIndex + 1), url];
              return {
                ...tab,
                url,
                history: newHistory,
                historyIndex: newHistory.length - 1,
              };
            }
            return tab;
          }),
        }));
      }
    );

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Removed URL polling; rely on webview-navigated events instead

  // Update navigation state based on history
  useEffect(() => {
    if (!activeTab) {
      setNavState({ canGoBack: false, canGoForward: false });
      return;
    }

    const historyIndex = activeTab.historyIndex ?? 0;
    const history = activeTab.history || [];

    // We can go back if we're not at the beginning of history
    const canGoBack = historyIndex > 0;
    // We can go forward if we're not at the end of history
    const canGoForward = historyIndex < history.length - 1;

    setNavState({ canGoBack, canGoForward });
  }, [activeTab]);

  return (
    <div className="flex h-screen flex-col">
      <TopBar
        canGoBack={navState.canGoBack}
        canGoForward={navState.canGoForward}
        currentUrl={activeTab?.url || ""}
        onBack={handleBack}
        onForward={handleForward}
        onNavigate={navigateActiveTab}
        onReload={handleReload}
      />

      <TabStrip
        activeTabId={state.activeTabId}
        onNewTab={createNewTab}
        onTabClick={selectTab}
        onTabClose={closeTab}
        tabs={state.tabs}
      />

      <div className="flex flex-1">
        <WebviewContainer activeTabId={state.activeTabId} tabs={state.tabs} />
        <AssistantPanel />
      </div>
    </div>
  );
}

export default App;
