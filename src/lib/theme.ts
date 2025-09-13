import { setTheme as setAppTheme } from "@tauri-apps/api/app";
import { listen, TauriEvent } from "@tauri-apps/api/event";

export type ThemeChoice = "system" | "light" | "dark";
const KEY = "theme-preference";

export async function applyTheme(choice: ThemeChoice) {
  await setAppTheme(choice === "system" ? null : choice);

  try {
    localStorage.setItem(KEY, choice);
  } catch {
    // Ignore localStorage errors
  }

  syncDom(choice);
}

export async function initTheme() {
  const saved = (localStorage.getItem(KEY) as ThemeChoice) ?? "system";
  await applyTheme(saved);

  await listen(TauriEvent.WINDOW_THEME_CHANGED, () => {
    const pref = (localStorage.getItem(KEY) as ThemeChoice) ?? "system";
    if (pref === "system") {
      syncDom("system");
    }
  });
}

export function getCurrentTheme(): ThemeChoice {
  return (localStorage.getItem(KEY) as ThemeChoice) ?? "system";
}

function syncDom(choice: ThemeChoice) {
  const prefersDark = window.matchMedia?.(
    "(prefers-color-scheme: dark)"
  ).matches;
  const isDark = choice === "dark" || (choice === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", !!isDark);
}
