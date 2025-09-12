export interface Tab {
  id: string;
  title: string;
  url: string;
  active: boolean;
  webviewLabel: string;
  history?: string[]; // Track navigation history
  historyIndex?: number; // Current position in history
}

export interface BrowserState {
  tabs: Tab[];
  activeTabId: string | null;
}
