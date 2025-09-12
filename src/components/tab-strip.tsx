import type { Tab } from "../types";

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
    <div className="flex items-center overflow-x-auto border-gray-200 border-b bg-gray-100 px-2 py-1">
      <div className="flex items-center space-x-1">
        {tabs.map((tab) => (
          <div
            className={`flex cursor-pointer items-center rounded-t-lg px-3 py-1.5 ${
              tab.id === activeTabId
                ? "border-gray-300 border-t border-r border-l bg-white font-semibold"
                : "border border-transparent bg-gray-50 hover:bg-gray-100"
            }min-w-[120px] max-w-[200px]`}
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
          >
            <span className="flex-1 truncate text-sm">
              {tab.title || "New Tab"}
            </span>
            <button
              className="ml-2 text-gray-500 text-xs hover:text-gray-700"
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              type="button"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          className="rounded px-2 py-1 text-gray-600 hover:bg-gray-200"
          onClick={onNewTab}
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}
