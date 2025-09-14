use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl};
use tauri::menu::{Menu, MenuItem, MenuItemKind, PredefinedMenuItem};
// WebviewWindowExt not used directly; plugin is initialized below

#[cfg(target_os = "macos")]
use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

#[cfg(target_os = "windows")]
use window_vibrancy::{apply_mica, apply_acrylic};

#[tauri::command]
async fn create_browser_webview(
    window: tauri::Window,
    label: String,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    println!("[Rust] Creating webview '{}' at position ({}, {}) with size {}x{}", label, x, y, width, height);
    println!("[Rust] URL: {}", url);
    
    let url_parsed = url.parse::<url::Url>()
        .map_err(|e| format!("Failed to parse URL: {}", e))?;
    
    // Coordinates are already provided in logical (CSS) pixels from the frontend
    let logical_pos = LogicalPosition::new(x, y);
    let logical_size = LogicalSize::new(width, height);

    // Inject a lightweight telemetry script into every webview.
    // It streams page info, basic performance, network metadata, console/error signals, and selection snippets
    // back to the main window via Tauri's event API. This is an initial prototype and intentionally minimal.
    let navigation_script = format!(r#"
        (() => {{
          const LABEL = {label:?};
          const toMain = async (event, payload) => {{
            try {{
              const p = Object.assign({{ label: LABEL, ts: Date.now() }}, payload);
              if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.emitTo) {{
                await window.__TAURI__.event.emitTo('main', event, p);
              }} else if (window.__TAURI__ && window.__TAURI__.event && window.__TAURI__.event.emit) {{
                await window.__TAURI__.event.emit(event, p);
              }}
            }} catch (_) {{}}
          }};

          const limit = (arr, n = 25) => arr.slice(-n);
          let recentLogs = [];
          let lastSelection = '';

          const snapshot = () => {{
            try {{
              const metas = {{}};
              for (const m of document.querySelectorAll('meta[name][content], meta[property][content]')) {{
                const key = m.getAttribute('name') || m.getAttribute('property');
                if (key && !(key in metas)) metas[key] = m.getAttribute('content') || '';
              }}
              const links = Array.from(document.querySelectorAll('a[href]')).slice(0, 200).map(a => ({{
                href: a.href,
                text: (a.textContent || '').trim().slice(0, 140),
              }}));
              const headings = Array.from(document.querySelectorAll('h1,h2,h3')).slice(0, 50).map(h => ({{
                tag: h.tagName,
                text: (h.textContent || '').trim().slice(0, 160),
              }}));
              const icons = Array.from(document.querySelectorAll('link[rel~="icon"]')).map(l => l.href);
              const themeColor = (document.querySelector('meta[name="theme-color"]')?.content || null);
              toMain('webview-telemetry', {{
                kind: 'page-info',
                title: document.title,
                url: location.href,
                lang: document.documentElement.getAttribute('lang') || null,
                metas,
                icons,
                themeColor,
                links,
                headings,
              }});
            }} catch (_) {{}}
          }};

          // initial snapshot and on DOMContentLoaded
          if (document.readyState !== 'loading') snapshot();
          document.addEventListener('DOMContentLoaded', snapshot, {{ once: true }});

          // selection changes
          document.addEventListener('selectionchange', () => {{
            try {{
              const sel = window.getSelection();
              const text = (sel && sel.toString()) ? sel.toString().trim().slice(0, 500) : '';
              if (text && text !== lastSelection) {{
                lastSelection = text;
                toMain('webview-telemetry', {{ kind: 'selection', text }});
              }}
            }} catch (_) {{}}
          }});

          // Performance observers
          try {{
            const perfHandler = (list) => {{
              for (const e of list.getEntries()) {{
                if (e.entryType === 'resource') {{
                  toMain('webview-telemetry', {{ kind: 'resource', item: {{
                    type: e.initiatorType,
                    name: e.name,
                    duration: e.duration,
                    startTime: e.startTime,
                    transferSize: e.transferSize,
                  }} }});
                }} else if (e.entryType === 'paint') {{
                  toMain('webview-telemetry', {{ kind: 'paint', name: e.name, startTime: e.startTime }});
                }} else if (e.entryType === 'largest-contentful-paint') {{
                  toMain('webview-telemetry', {{ kind: 'lcp', startTime: e.startTime, size: e.size, url: e.url || null }});
                }} else if (e.entryType === 'navigation') {{
                  toMain('webview-telemetry', {{ kind: 'navigation', domContentLoaded: e.domContentLoadedEventEnd, loadEventEnd: e.loadEventEnd, type: e.type }});
                }} else if (e.entryType === 'longtask') {{
                  toMain('webview-telemetry', {{ kind: 'longtask', startTime: e.startTime, duration: e.duration }});
                }}
              }}
            }};
            const po = new PerformanceObserver(perfHandler);
            po.observe({{ entryTypes: ['resource', 'paint', 'largest-contentful-paint', 'navigation', 'longtask'] }});
          }} catch (_) {{}}

          // Wrap fetch
          try {{
            const origFetch = window.fetch;
            window.fetch = async (...args) => {{
              const started = performance.now();
              const input = args[0];
              const info = args[1] || {{}};
              const url = (typeof input === 'string') ? input : input.url;
              const method = (info && info.method) || (typeof input !== 'string' && input.method) || 'GET';
              try {{
                const res = await origFetch(...args);
                const ended = performance.now();
                let preview = null;
                const ct = res.headers.get('content-type') || '';
                if (ct.includes('application/json')) {{
                  try {{ preview = JSON.stringify(await res.clone().json()).slice(0, 2000); }} catch (_) {{}}
                }} else if (ct.startsWith('text/')) {{
                  try {{ preview = (await res.clone().text()).slice(0, 2000); }} catch (_) {{}}
                }}
                toMain('webview-telemetry', {{ kind: 'fetch', url, method, status: res.status, duration: ended - started, preview }});
                return res;
              }} catch (err) {{
                const ended = performance.now();
                toMain('webview-telemetry', {{ kind: 'fetch-error', url, method, error: String(err), duration: ended - started }});
                throw err;
              }}
            }};
          }} catch (_) {{}}

          // Wrap XHR
          try {{
            const OrigXHR = window.XMLHttpRequest;
            function XHR() {{
              const xhr = new OrigXHR();
              let url = '';
              let method = 'GET';
              let started = 0;
              const origOpen = xhr.open;
              const origSend = xhr.send;
              xhr.open = function(m, u, ...rest) {{ method = m; url = u; return origOpen.call(this, m, u, ...rest); }};
              xhr.send = function(...rest) {{ started = performance.now(); return origSend.apply(this, rest); }};
              xhr.addEventListener('loadend', function() {{
                const ended = performance.now();
                toMain('webview-telemetry', {{ kind: 'xhr', url, method, status: xhr.status, duration: ended - started }});
              }});
              return xhr;
            }}
            window.XMLHttpRequest = XHR;
          }} catch (_) {{}}

          // Console proxy
          (() => {{
            const levels = ['log', 'info', 'warn', 'error'];
            for (const level of levels) {{
              const orig = console[level];
              console[level] = function(...args) {{
                try {{
                  const msg = args.map(a => {{ try {{ return typeof a === 'string' ? a : JSON.stringify(a); }} catch {{ return String(a); }} }}).join(' ');
                  recentLogs = limit([...recentLogs, {{ level, msg }}], 50);
                  toMain('webview-telemetry', {{ kind: 'console', level, message: msg }});
                }} catch (_) {{}}
                return orig.apply(this, args);
              }};
            }}
          }})();

          // Errors
          window.addEventListener('error', (e) => toMain('webview-telemetry', {{ kind: 'error', message: e && e.message || 'Error', source: e && e.filename || null, lineno: e && e.lineno || null, colno: e && e.colno || null }}), {{ capture: true }});
          window.addEventListener('unhandledrejection', (e) => toMain('webview-telemetry', {{ kind: 'unhandledrejection', reason: String(e && e.reason) }}), {{ capture: true }});

          // Periodic lightweight ping of basic info
          setInterval(() => {{
            try {{ toMain('webview-telemetry', {{ kind: 'heartbeat', title: document.title, url: location.href }}); }} catch (_) {{}}
          }}, 5000);

          // Init log for sanity
          toMain('webview-telemetry', {{ kind: 'init' }});
        }})();
    "#, label = label);

    let label_clone = label.clone();
    let window_clone = window.clone();
    let label_for_page_load = label.clone();
    let window_for_page_load = window.clone();
    
    let result = window.add_child(
        WebviewBuilder::new(label.clone(), WebviewUrl::External(url_parsed))
            .initialization_script(&navigation_script)
            .on_navigation(move |url| {
                println!("[Rust] Webview '{}' navigating to: {}", label_clone, url);
                
                // Emit an event when navigation starts
                let _ = window_clone.emit("webview-navigation-started", serde_json::json!({
                    "label": label_clone.clone(),
                    "url": url.to_string()
                }));
                
                // Allow all navigation
                true
            })
            .on_page_load(move |_window, payload| {
                let url = payload.url();
                println!("[Rust] Webview '{}' page loaded with URL: {}", label_for_page_load, url);
                
                // Emit an event when page finishes loading
                let _ = window_for_page_load.emit("webview-navigated", serde_json::json!({
                    "label": label_for_page_load.clone(),
                    "url": url.to_string()
                }));
            })
            .on_document_title_changed({
                let window_for_title = window.clone();
                let label_for_title = label.clone();
                move |_wv, title| {
                    println!(
                        "[Rust] Webview '{}' title changed: {}",
                        label_for_title, title
                    );
                    let _ = window_for_title.emit(
                        "webview-title-changed",
                        serde_json::json!({
                            "label": label_for_title.clone(),
                            "title": title
                        }),
                    );
                }
            }),
        logical_pos,
        logical_size,
    );
    
    match result {
        Ok(_webview) => {
            println!("[Rust] Successfully created webview '{}'", label);
            Ok(())
        }
        Err(e) => {
            println!("[Rust] Failed to create webview '{}': {}", label, e);
            Err(format!("Failed to create webview: {}", e))
        }
    }
}

#[tauri::command]
async fn show_webview(window: tauri::Window, label: String) -> Result<(), String> {
    println!("[Rust] Showing webview '{}'", label);
    if let Some(webview) = window.get_webview(&label) {
        webview.show().map_err(|e| e.to_string())?;
        println!("[Rust] Webview '{}' shown successfully", label);
    } else {
        println!("[Rust] Webview '{}' not found!", label);
    }
    Ok(())
}

#[tauri::command]
async fn hide_webview(window: tauri::Window, label: String) -> Result<(), String> {
    println!("[Rust] Hiding webview '{}'", label);
    if let Some(webview) = window.get_webview(&label) {
        webview.hide().map_err(|e| e.to_string())?;
        println!("[Rust] Webview '{}' hidden successfully", label);
    } else {
        println!("[Rust] Webview '{}' not found!", label);
    }
    Ok(())
}

#[tauri::command]
async fn close_webview(window: tauri::Window, label: String) -> Result<(), String> {
    if let Some(webview) = window.get_webview(&label) {
        webview.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn update_webview_bounds(
    window: tauri::Window,
    label: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    println!("[Rust] Updating webview '{}' position to ({}, {}) with size {}x{}", label, x, y, width, height);
    
    if let Some(webview) = window.get_webview(&label) {
        let logical_pos = LogicalPosition::new(x, y);
        let logical_size = LogicalSize::new(width, height);

        webview.set_position(logical_pos).map_err(|e| e.to_string())?;
        webview.set_size(logical_size).map_err(|e| e.to_string())?;
        
        println!("[Rust] Webview '{}' bounds updated successfully", label);
    } else {
        println!("[Rust] Webview '{}' not found!", label);
    }
    Ok(())
}

#[tauri::command]
async fn navigate_webview(window: tauri::Window, label: String, url: String) -> Result<(), String> {
    println!("[Rust] Navigating webview '{}' to '{}'", label, url);
    if let Some(webview) = window.get_webview(&label) {
        // Navigate to the new URL using JavaScript
        let script = format!("window.location.href = '{}'", url);
        webview.eval(&script).map_err(|e| e.to_string())?;
        println!("[Rust] Webview '{}' navigated to '{}' successfully", label, url);
    } else {
        println!("[Rust] Webview '{}' not found!", label);
        return Err(format!("Webview '{}' not found", label));
    }
    Ok(())
}

#[tauri::command]
async fn refresh_webview(window: tauri::Window, label: String) -> Result<(), String> {
    println!("[Rust] Refreshing webview '{}'", label);
    if let Some(webview) = window.get_webview(&label) {
        webview.eval("location.reload()").map_err(|e| e.to_string())?;
        println!("[Rust] Webview '{}' refreshed successfully", label);
    } else {
        println!("[Rust] Webview '{}' not found!", label);
        return Err(format!("Webview '{}' not found", label));
    }
    Ok(())
}

#[tauri::command]
async fn navigate_back_webview(window: tauri::Window, label: String) -> Result<(), String> {
    println!("[Rust] Navigating back in webview '{}'", label);
    if let Some(webview) = window.get_webview(&label) {
        webview.eval("history.back()").map_err(|e| e.to_string())?;
        println!("[Rust] Webview '{}' navigated back successfully", label);
    } else {
        println!("[Rust] Webview '{}' not found!", label);
        return Err(format!("Webview '{}' not found", label));
    }
    Ok(())
}

#[tauri::command]
async fn navigate_forward_webview(window: tauri::Window, label: String) -> Result<(), String> {
    println!("[Rust] Navigating forward in webview '{}'", label);
    if let Some(webview) = window.get_webview(&label) {
        webview.eval("history.forward()").map_err(|e| e.to_string())?;
        println!("[Rust] Webview '{}' navigated forward successfully", label);
    } else {
        println!("[Rust] Webview '{}' not found!", label);
        return Err(format!("Webview '{}' not found", label));
    }
    Ok(())
}



// (removed) poll_webview_url: replaced by event-driven navigation reporting

#[tauri::command]
async fn check_navigation_state(window: tauri::Window, label: String) -> Result<(bool, bool), String> {
    println!("[Rust] Checking navigation state for webview '{}'", label);
    if let Some(_webview) = window.get_webview(&label) {
        // Unfortunately, browsers don't expose navigation state reliably due to security
        // For now, we'll enable back after the first navigation
        // This will be improved when Tauri adds proper navigation event support
        
        // Always enable back button (browser will handle if it can't go back)
        // Never enable forward button (can't reliably detect)
        Ok((true, false))
    } else {
        println!("[Rust] Webview '{}' not found!", label);
        return Err(format!("Webview '{}' not found", label));
    }
}

#[tauri::command]
fn set_default_browser(app: tauri::AppHandle, _bundle_id: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        use objc::{class, msg_send, sel, sel_impl};
        use objc::runtime::{Object, Sel, BOOL, YES};
        use objc_foundation::{INSString, NSString};
        use std::ptr;

        // Run on the main thread – UI work in AppKit must.
        app.run_on_main_thread(move || unsafe {
            println!("[set_default_browser] Starting on main thread");

            // Get our .app bundle URL
            let nsbundle: *mut Object = msg_send![class!(NSBundle), mainBundle];
            let app_url: *mut Object = msg_send![nsbundle, bundleURL];
            if app_url.is_null() {
                // we can't emit errors from inside the closure, so log to stderr
                eprintln!("[set_default_browser] ERROR: could not obtain bundleURL");
                return;
            }

            // Get the bundle identifier for debugging
            let bundle_id_ns: *mut Object = msg_send![nsbundle, bundleIdentifier];
            if !bundle_id_ns.is_null() {
                let bundle_id_bytes: *const std::os::raw::c_char = msg_send![bundle_id_ns, UTF8String];
                let bundle_id_str = std::ffi::CStr::from_ptr(bundle_id_bytes).to_string_lossy();
                println!("[set_default_browser] Bundle ID: {}", bundle_id_str);
            } else {
                println!("[set_default_browser] WARNING: No bundle identifier found");
            }

            // Get the app URL string for debugging
            let url_str: *mut Object = msg_send![app_url, absoluteString];
            if !url_str.is_null() {
                let url_bytes: *const std::os::raw::c_char = msg_send![url_str, UTF8String];
                let url_string = std::ffi::CStr::from_ptr(url_bytes).to_string_lossy();
                println!("[set_default_browser] App URL: {}", url_string);
            }

            let workspace: *mut Object = msg_send![class!(NSWorkspace), sharedWorkspace];
            println!("[set_default_browser] Got NSWorkspace instance");

            // Use modern API (macOS 12+) to set default app for both http and https.
            // Also attempt to associate HTML content type like Chromium does.
            let sel_set: Sel = sel!(setDefaultApplicationAtURL:toOpenURLsWithScheme:completionHandler:);

            // Guard for macOS 12+: only call if the selector exists
            let responds: BOOL = msg_send![workspace, respondsToSelector: sel_set];
            println!("[set_default_browser] Checking if selector exists: {}", if responds == YES { "YES" } else { "NO" });
            if responds != YES {
                // Fallback for very old macOS (<=11): old LaunchServices path (deprecated).
                // You can remove this block if you only support 12+.
                #[allow(non_snake_case)]
                extern "C" {
                    fn LSSetDefaultHandlerForURLScheme(
                        inScheme: *mut std::ffi::c_void,
                        inHandlerBundleIdentifier: *mut std::ffi::c_void,
                    ) -> i32;
                }
                use core_foundation::base::TCFType;
                use core_foundation::string::CFString;

                // Set both http and https on legacy systems as well.
                let scheme_http = CFString::new("http");
                let scheme_https = CFString::new("https");
                // Use our real bundle id if you want the fallback – reading it here keeps it correct.
                let bundle_id_cf = {
                    let id_ns: *mut Object = msg_send![nsbundle, bundleIdentifier];
                    let bytes: *const std::os::raw::c_char = msg_send![id_ns, UTF8String];
                    let s = std::ffi::CStr::from_ptr(bytes).to_string_lossy().into_owned();
                    CFString::new(&s)
                };
                let s1 = LSSetDefaultHandlerForURLScheme(
                    scheme_http.as_concrete_TypeRef() as *mut _,
                    bundle_id_cf.as_concrete_TypeRef() as *mut _,
                );
                let s2 = LSSetDefaultHandlerForURLScheme(
                    scheme_https.as_concrete_TypeRef() as *mut _,
                    bundle_id_cf.as_concrete_TypeRef() as *mut _,
                );
                eprintln!("[set_default_browser] Using LSSetDefaultHandlerForURLScheme fallback, http={}, https={}", s1, s2);
                return;
            }

            println!("[set_default_browser] Calling NSWorkspace setDefaultApplicationAtURL for http/https...");

            // Call the AppKit API that shows the system consent dialog.
            // Pass nil (null pointer) for completion handler – dialog still appears when needed.
            let nil: *mut Object = ptr::null_mut();

            // Request BOTH schemes explicitly.
            let http = NSString::from_str("http");
            let https = NSString::from_str("https");

            let _: () = msg_send![
              workspace,
              setDefaultApplicationAtURL: app_url
              toOpenURLsWithScheme: http
              completionHandler: nil
            ];
            let _: () = msg_send![
              workspace,
              setDefaultApplicationAtURL: app_url
              toOpenURLsWithScheme: https
              completionHandler: nil
            ];

            // Also associate for HTML content type when API is available (macOS 12+ UTType).
            let sel_set_ut: Sel = sel!(setDefaultApplicationAtURL:toOpenContentType:completionHandler:);
            let responds_ut: BOOL = msg_send![workspace, respondsToSelector: sel_set_ut];
            if responds_ut == YES {
                let ut_html: *mut Object = msg_send![class!(UTType), typeWithIdentifier: NSString::from_str("public.html")];
                if !ut_html.is_null() {
                    let _: () = msg_send![
                        workspace,
                        setDefaultApplicationAtURL: app_url
                        toOpenContentType: ut_html
                        completionHandler: nil
                    ];
                }
            }

            // Bring CoreServicesUIAgent to the foreground so the consent dialog is visible.
            // This mirrors Chromium's workaround for dialog ordering issues across Spaces.
            let running: *mut Object = msg_send![workspace, runningApplications];
            let count: usize = msg_send![running, count];
            for i in 0..count {
                let app_obj: *mut Object = msg_send![running, objectAtIndex: i];
                let bid: *mut Object = msg_send![app_obj, bundleIdentifier];
                if !bid.is_null() {
                    let bytes: *const std::os::raw::c_char = msg_send![bid, UTF8String];
                    if !bytes.is_null() {
                        let s = std::ffi::CStr::from_ptr(bytes).to_string_lossy();
                        if s == "com.apple.coreservices.uiagent" {
                            // 3 == NSApplicationActivateAllWindows | NSApplicationActivateIgnoringOtherApps
                            let _: BOOL = msg_send![app_obj, activateWithOptions: 3usize];
                            println!("[set_default_browser] Activated CoreServicesUIAgent for consent dialog");
                            break;
                        }
                    }
                }
            }

            println!("[set_default_browser] NSWorkspace calls completed");
        }).map_err(|e| e.to_string())?;

        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Default browser setting is only supported on macOS".to_string())
    }
}

#[tauri::command]
fn get_default_http_handler() -> Result<String, String> {
    #[cfg(target_os = "macos")]
    unsafe {
        use core_foundation::base::TCFType;
        use core_foundation::string::CFString;
        use core_foundation_sys::string::CFStringRef;
        // LaunchServices API reflects changes promptly; NSWorkspace may cache.
        #[allow(non_snake_case)]
        extern "C" {
            fn LSCopyDefaultHandlerForURLScheme(inScheme: CFStringRef) -> CFStringRef;
        }
        let http = CFString::new("http");
        let handler_ref = LSCopyDefaultHandlerForURLScheme(http.as_concrete_TypeRef());
        if handler_ref.is_null() {
            return Ok("(none)".into());
        }
        let handler = { CFString::wrap_under_create_rule(handler_ref) };
        Ok(handler.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("macOS only".into())
    }
}

// Devtools command: available in debug builds or when the `devtools` feature is enabled.
#[cfg(any(debug_assertions, feature = "devtools"))]
#[tauri::command]
fn open_main_devtools(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window("main") {
        w.open_devtools();
    }
    Ok(())
}

#[cfg(not(any(debug_assertions, feature = "devtools")))]
#[tauri::command]
fn open_main_devtools(_app: tauri::AppHandle) -> Result<(), String> {
    Err("Devtools are disabled in this build".to_string())
}

#[tauri::command]
fn list_http_candidates() -> Result<Vec<String>, String> {
    #[cfg(target_os = "macos")]
    unsafe {
        use objc::{class, msg_send, sel, sel_impl};
        use objc::runtime::Object;
        use objc_foundation::{INSString, NSString};

        let ws: *mut Object = msg_send![class!(NSWorkspace), sharedWorkspace];
        let http: *mut Object = msg_send![class!(NSURL), URLWithString: NSString::from_str("http:")];
        if http.is_null() { return Err("Could not create http URL".into()); }
        let urls: *mut Object = msg_send![ws, URLsForApplicationsToOpenURL: http];
        if urls.is_null() {
            return Ok(Vec::new());
        }
        let fm: *mut Object = msg_send![class!(NSFileManager), defaultManager];
        let mut out: Vec<String> = Vec::new();
        let count: usize = msg_send![urls, count];
        for i in 0..count {
            let u: *mut Object = msg_send![urls, objectAtIndex: i];
            if u.is_null() { continue; }
            let bundle: *mut Object = msg_send![class!(NSBundle), bundleWithURL: u];
            if bundle.is_null() { continue; }
            let bid: *mut Object = msg_send![bundle, bundleIdentifier];
            let path: *mut Object = msg_send![u, path];
            let name: *mut Object = msg_send![fm, displayNameAtPath: path];
            let mut entry = String::new();
            if !name.is_null() {
                let name_bytes: *const std::os::raw::c_char = msg_send![name, UTF8String];
                if !name_bytes.is_null() {
                    entry.push_str(&std::ffi::CStr::from_ptr(name_bytes).to_string_lossy());
                }
            }
            if !bid.is_null() {
                let bid_bytes: *const std::os::raw::c_char = msg_send![bid, UTF8String];
                if !bid_bytes.is_null() {
                    let id_str = std::ffi::CStr::from_ptr(bid_bytes).to_string_lossy();
                    if !entry.is_empty() {
                        entry.push_str(" (");
                        entry.push_str(&id_str);
                        entry.push(')');
                    } else {
                        entry.push_str(&id_str);
                    }
                }
            }
            if !entry.is_empty() {
                out.push(entry);
            }
        }
        Ok(out)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("macOS only".into())
    }
}

#[tauri::command]
fn is_default_browser() -> Result<bool, String> {
    #[cfg(target_os = "macos")]
    unsafe {
        use core_foundation::base::TCFType;
        use core_foundation::string::CFString;
        use core_foundation_sys::string::CFStringRef;
        use objc::{class, msg_send, sel, sel_impl};
        use objc::runtime::Object;

        #[allow(non_snake_case)]
        extern "C" {
            fn LSCopyDefaultHandlerForURLScheme(inScheme: CFStringRef) -> CFStringRef;
        }

        // Current default via LaunchServices
        let http = CFString::new("http");
        let handler_ref = LSCopyDefaultHandlerForURLScheme(http.as_concrete_TypeRef());
        if handler_ref.is_null() {
            return Ok(false);
        }
        let handler = CFString::wrap_under_create_rule(handler_ref).to_string();

        // Our bundle id
        let main_bundle: *mut Object = msg_send![class!(NSBundle), mainBundle];
        let our_bid_ns: *mut Object = msg_send![main_bundle, bundleIdentifier];
        if our_bid_ns.is_null() { return Ok(false); }
        let our_bid_bytes: *const std::os::raw::c_char = msg_send![our_bid_ns, UTF8String];
        if our_bid_bytes.is_null() { return Ok(false); }
        let our_bid = std::ffi::CStr::from_ptr(our_bid_bytes).to_string_lossy().into_owned();

        Ok(handler == our_bid)
    }
    #[cfg(not(target_os = "macos"))]
    {
        Ok(false)
    }
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_decorum::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            create_browser_webview,
            show_webview,
            hide_webview,
            close_webview,
            update_webview_bounds,
            navigate_webview,
            refresh_webview,
            navigate_back_webview,
            navigate_forward_webview,
            check_navigation_state,
            set_default_browser,
            get_default_http_handler,
            list_http_candidates,
            is_default_browser,
            open_main_devtools
        ])
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();
            println!("[Rust] Main window created, label: {}", main_window.label());
            // Auto-open devtools on debug builds to aid diagnostics
            #[cfg(debug_assertions)]
            {
                main_window.open_devtools();
            }
            
            // Apply vibrancy effect based on platform
            #[cfg(target_os = "macos")]
            {
                // Use HudWindow for a dark, glassy effect
                // Other options: Sidebar, UnderWindowBackground, UnderPageBackground, etc.
                apply_vibrancy(&main_window, NSVisualEffectMaterial::HudWindow, None, None)
                    .expect("Failed to apply window vibrancy on macOS");
                println!("[Rust] Applied vibrancy effect on macOS");
            }
            
            #[cfg(target_os = "windows")]
            {
                // Try Mica for Windows 11, fall back to Acrylic
                if apply_mica(&main_window, None).is_err() {
                    // Fallback to Acrylic with a dark tint
                    apply_acrylic(&main_window, Some((18, 18, 18, 125)))
                        .expect("Failed to apply window vibrancy on Windows");
                    println!("[Rust] Applied Acrylic effect on Windows");
                } else {
                    println!("[Rust] Applied Mica effect on Windows");
                }
            }
            
            // Application menu (macOS: brsr > Settings…)
            #[cfg(target_os = "macos")]
            {
                // Ensure we have the default macOS menu, then inject Settings… into the Application menu.
                if app.menu().is_none() {
                    let default_menu = Menu::default(&app.app_handle())?;
                    app.set_menu(default_menu)?;
                }

                if let Some(menu) = app.menu() {
                    let app_name = app.package_info().name.clone();
                    // Find the application submenu by comparing the visible text.
                    if let Ok(items) = menu.items() {
                        for item in items {
                            if let MenuItemKind::Submenu(sub) = item {
                                if let Ok(text) = sub.text() {
                                    if text == app_name {
                                        if sub.get("settings").is_none() {
                                            let settings = MenuItem::with_id(
                                                app,
                                                "settings",
                                                "Settings…",
                                                true,
                                                Some("CmdOrCtrl+,"),
                                            )?;
                                            // Insert AFTER the first separator (default index 1):
                                            // About, Separator, [Settings here], Services, …
                                            let _ = sub.insert(&settings, 2);

                                            // Ensure a separator immediately AFTER Settings
                                            let sep_after = PredefinedMenuItem::separator(app)?;
                                            let _ = sub.insert(&sep_after, 3);
                                        }
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                app.on_menu_event(|app_handle, event| {
                    if event.id() == "settings" {
                        let _ = app_handle.emit_to("main", "open-settings", ());
                    }
                });
            }

            // List all webviews
            let webviews = main_window.webviews();
            println!("[Rust] Initial webviews count: {}", webviews.len());
            for (label, _wv) in webviews {
                println!("[Rust] - Webview: {}", label);
            }
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
