# Dev Notes

## How to edit window styling
- Modify the vibrancy effect in `src-tauri/src/lib.rs` - change `NSVisualEffectMaterial::HudWindow` to other options like `Sidebar`, `UnderWindowBackground`, or `UnderPageBackground`

## How to edit traffic light inset
- Adjust the traffic light position in `src-tauri/src/lib.rs` - change the values in `set_traffic_lights_inset(12.0, 16.0)` where first number is horizontal offset, second is vertical offset
