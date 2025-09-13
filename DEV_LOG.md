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

## 2025-09-13 — Default browser support + “Make Default” button

What we shipped
- macOS default‑browser capability end‑to‑end: brsr is now eligible as a system default browser and can reliably trigger Apple’s consent dialog to set itself as default.
- A working “Make Default” button in the UI that invokes the system dialog consistently.

How we made brsr eligible as a browser
- Bundle metadata (Info.plist):
  - `CFBundleURLTypes` declares both `http` and `https` (role: `Viewer`).
  - `CFBundleDocumentTypes` declares web content types: `public.html`, `public.xhtml`, and `com.apple.web-internet-location`. We also set `LSHandlerRank = Alternate` on each to mirror common browser behavior.
- Tauri configuration: `tauri.conf.json` registers the deep‑link plugin for `http` and `https` under `plugins.deep-link.desktop.schemes` so dev and runtime code paths both recognize incoming links.
- Installation/registration requirement: For Launch Services to recognize the app as a browser candidate, the bundled app must be run from `/Applications` (not dev mode and not directly from the build output). Once installed, `lsregister` indexes the bundle and exposes it as a candidate for the system default browser.

The macOS API call (Rust, Tauri side)
- We use AppKit’s modern API (macOS 12+):
  - `-[NSWorkspace setDefaultApplicationAtURL:toOpenURLsWithScheme:completionHandler:]` for both `http` and `https`.
  - `-[NSWorkspace setDefaultApplicationAtURL:toOpenContentType:completionHandler:]` for the HTML UTType (`public.html`) when available.
- We then bring the consent dialog to the front by activating CoreServices’ UI agent:
  - Enumerate `NSWorkspace` `runningApplications` and call `activateWithOptions:` on the app with bundle id `com.apple.coreservices.uiagent` using flags `NSApplicationActivateAllWindows | NSApplicationActivateIgnoringOtherApps` (value `3`).
  - Rationale: the dialog is owned by `CoreServicesUIAgent` and can appear behind our window or on another Space; explicit activation mirrors Chromium’s workaround and makes the sheet visible.
- Legacy fallback (≤ macOS 11):
  - Call `LSSetDefaultHandlerForURLScheme` for both `http` and `https`.
- Commands added for diagnostics:
  - `get_default_http_handler` → returns current default browser bundle id for `http:`.
  - `list_http_candidates` → lists the candidate apps macOS would consider for `http:`.
  - `open_main_devtools` (debug/feature‑gated) → opens DevTools for the main window. DevTools also auto‑open on debug builds.

Frontend behavior
- The Top Bar previously marked the entire row as a drag region. Even with `.no-drag` children, this can swallow clicks on macOS overlays. We removed the row-level drag region and restricted draggable areas to the left/right spacer strips only.
- The “Make Default” button now directly invokes `invoke("set_default_browser")` without using `window.confirm`. WKWebView (and Tauri v2 defaults) can suppress native `window.confirm`, causing it to return `false` immediately and making it look like the button does nothing. We replaced it with direct invocation plus a post‑action notice.
- Added console logs around the button handler to simplify debugging.

Operational notes / testing checklist
- Always test from `/Applications/brsr.app`.
- Inspect installed Info.plist, not the source file:
  - `/usr/libexec/PlistBuddy -c 'Print :CFBundleURLTypes:0:CFBundleURLSchemes' "/Applications/brsr.app/Contents/Info.plist"`
  - `/usr/libexec/PlistBuddy -c 'Print :CFBundleDocumentTypes:0:LSItemContentTypes' "/Applications/brsr.app/Contents/Info.plist"`
- Verify Launch Services sees brsr and its claims:
  - `lsregister -dump | grep -n "com.brsr.browser" -A5`
  - Look for `claimed schemes: http:, https:` and `claimed UTIs: public.html, public.xhtml, com.apple.web-internet-location, com.apple.default-app.web-browser`.
- If the dialog seems missing, it may be behind other apps or on another Space. After invoking, check Mission Control or Cmd‑Tab; we also activate `CoreServicesUIAgent` to pull it frontmost.
- If brsr doesn’t appear as a candidate, reindex:
  - `lsregister -f /Applications/brsr.app && killall -u "$USER" lsd`

Lessons learned / pitfalls
- The system consent dialog is owned by `CoreServicesUIAgent`, not our app window, and it can open behind or on a different Space. Explicitly activating the agent improves reliability.
- You must set both `http` and `https` (and typically associate `public.html`) to match first‑party browser behavior.
- Dev/bundled location matters. Launch Services only treats proper app bundles (usually under `/Applications`) as browser candidates.
- `window.confirm` is unreliable in WKWebView/Tauri and can be suppressed in release contexts. Prefer an in‑app modal/toast confirmation if needed.
- Duplicate bundles with the same identifier can confuse Launch Services.

Files touched (high level)
- `src-tauri/src/lib.rs`: default browser command (both schemes + UTType, UI agent activation), legacy fallback, diagnostic commands, devtools helper.
- `src-tauri/Info.plist`: ensured schemes and document types; added `LSHandlerRank = Alternate` for web content types.
- `src-tauri/tauri.conf.json`: (pre‑existing) deep‑link plugin configured for `http`/`https`.
- `src/components/top-bar.tsx`: drag region tightened to avoid swallowed clicks; handler logs and awaits.
- `src/app.tsx`: removed `window.confirm`; direct `invoke("set_default_browser")` with a user tip afterward.
