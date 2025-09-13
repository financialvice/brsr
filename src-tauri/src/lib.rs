use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl};
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_decorum::init())
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
            check_navigation_state
        ])
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();
            println!("[Rust] Main window created, label: {}", main_window.label());
            
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
