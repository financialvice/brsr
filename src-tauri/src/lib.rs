use tauri::{Emitter, LogicalPosition, LogicalSize, Manager, WebviewBuilder, WebviewUrl};
use tauri_plugin_decorum::WebviewWindowExt;

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
    
    // Convert physical coordinates (from the frontend) to logical, per Tauri expectations
    let scale = window
        .scale_factor()
        .map_err(|e| format!("Failed to get scale factor: {}", e))?
        as f64;

    let logical_pos = LogicalPosition::new(x / scale, y / scale);
    let logical_size = LogicalSize::new(width / scale, height / scale);

    // Simple script to emit navigation events when the page loads
    let navigation_script = format!(r#"
        console.log('[Webview {}] Initialization script running');
    "#, label);

    let label_clone = label.clone();
    let window_clone = window.clone();
    let label_for_page_load = label.clone();
    let window_for_page_load = window.clone();
    
    let result = window.add_child(
        WebviewBuilder::new(label.clone(), WebviewUrl::External(url_parsed))
            .auto_resize()
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
        let scale = window
            .scale_factor()
            .map_err(|e| format!("Failed to get scale factor: {}", e))?
            as f64;

        let logical_pos = LogicalPosition::new(x / scale, y / scale);
        let logical_size = LogicalSize::new(width / scale, height / scale);
        
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



#[tauri::command]
async fn poll_webview_url(window: tauri::Window, label: String) -> Result<String, String> {
    if let Some(webview) = window.get_webview(&label) {
        // Inject a script that will check the URL and emit it if changed
        let emit_script = format!(r#"
            (function() {{
                const currentUrl = window.location.href;
                const lastUrlKey = '__lastPolledUrl_{}';
                const lastUrl = window[lastUrlKey];
                
                if (!lastUrl || lastUrl !== currentUrl) {{
                    window[lastUrlKey] = currentUrl;
                    console.log('[Webview {}] URL changed to:', currentUrl);
                    
                    // We can't directly communicate back to Rust from eval,
                    // but we logged it for debugging
                    
                    // Return the URL (though we can't capture it in Rust)
                    return currentUrl;
                }}
                
                return null;
            }})();
        "#, label, label);
        
        // Execute the script
        webview.eval(&emit_script).map_err(|e| e.to_string())?;
        
        // We'll need to use the on_navigation callback for actual tracking
        Ok(String::from("Polling completed"))
    } else {
        // Return error but don't log - this is expected before webview is created
        return Err(format!("Webview '{}' not found", label));
    }
}

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
            check_navigation_state,
            poll_webview_url
        ])
        .setup(|app| {
            let main_window = app.get_webview_window("main").unwrap();
            println!("[Rust] Main window created, label: {}", main_window.label());
            
            // Create custom overlay titlebar for decorum
            main_window.create_overlay_titlebar()
                .expect("Failed to create overlay titlebar");
            
            // Apply vibrancy effect based on platform
            #[cfg(target_os = "macos")]
            {
                // Set custom inset for traffic lights (x, y offset)
                main_window.set_traffic_lights_inset(12.0, 16.0)
                    .expect("Failed to set traffic lights inset");
                
                // Use HudWindow for a dark, glassy effect
                // Other options: Sidebar, UnderWindowBackground, UnderPageBackground, etc.
                apply_vibrancy(&main_window, NSVisualEffectMaterial::HudWindow, None, None)
                    .expect("Failed to apply window vibrancy on macOS");
                println!("[Rust] Applied vibrancy effect and traffic lights inset on macOS");
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
