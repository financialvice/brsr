# Dev Log

## 2025-09-13 — macOS overlay titlebar + clickable toolbar
- Problem: Our back/forward/refresh buttons and URL input were unclickable when placed in the overlay titlebar row on macOS. Double‑clicking the input also maximized the window.
- Root cause: We were creating a native overlay titlebar view via `tauri-plugin-decorum` (`create_overlay_titlebar` + optional `set_traffic_lights_inset`). That native `NSVisualEffectView` sits above the web content and intercepts mouse events across the whole band; CSS `-webkit-app-region: no-drag` on children cannot override it.
- Fix we shipped:
  - Removed the native overlay view creation in `src-tauri/src/lib.rs`.
  - Kept `titleBarStyle: "Overlay"` in `src-tauri/tauri.conf.json` so traffic lights remain inline with the app’s toolbar.
  - Toolbar methodology for clickability + draggability:
    - Make the entire toolbar container the drag region (`data-tauri-drag-region` + `-webkit-app-region: drag`).
    - Mark interactive controls (buttons, form/input) with `-webkit-app-region: no-drag` via a `no-drag` class so they always receive clicks.
    - This works because the native overlay view was removed; with only HTML above the webview, macOS respects the no-drag overrides.
    - Use a small left padding to visually clear the traffic lights, and add optional empty drag spacers at the edges for more grab area.
- Takeaway:
  - Avoid native overlay titlebar views that intercept events unless they are configured to ignore mouse events.
  - For custom toolbars: make the container draggable and explicitly mark interactive children as `no-drag`. This yields “grab anywhere” UX while keeping all controls clickable.

## 2025-09-13 — How to edit window styling
- Vibrancy: change the material in `src-tauri/src/lib.rs` (e.g., `NSVisualEffectMaterial::HudWindow`, `Sidebar`, `UnderWindowBackground`).

## 2025-09-13 — Traffic light positioning (if we ever re‑enable the native overlay)
- If we bring back `create_overlay_titlebar`, we can adjust traffic lights via `set_traffic_lights_inset(x, y)`. Note: re‑enabling the overlay will block clicks in the overlay band unless the native view is made click‑through.
