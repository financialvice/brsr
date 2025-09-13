import { useEffect, useState } from "react";

const MAC_OS_USER_AGENT_REGEX = /Mac OS X/;

// Very small helper to know when to reserve a native titlebar overlay area
export function useIsMac(): boolean {
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    try {
      // Heuristic: reliably detects macOS in Tauri's WebView
      const ua = window.navigator.userAgent;
      setIsMac(MAC_OS_USER_AGENT_REGEX.test(ua));
    } catch {
      setIsMac(false);
    }
  }, []);

  return isMac;
}
