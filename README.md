# BRSR - MVP Generative Browser

A desktop browser prototype built with React, TypeScript, Vite, Tailwind CSS v3, and Tauri v2 with multi-webview support.

## Tech Stack

- **Frontend**: React + TypeScript + Vite
- **Styling**: Tailwind CSS v3 (Note: v4 had compatibility issues, using v3 for stability)
- **Desktop Framework**: Tauri v2
- **Multi-webview**: Experimental Tauri v2 webview API

## Features

✅ Tabbed browsing interface
✅ Independent webview per tab
✅ URL navigation bar with back/forward/reload
✅ Tab management (create, close, switch)
✅ Assistant panel (placeholder for future features)
✅ Responsive window resizing

## Project Structure

```
brsr/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── TabStrip.tsx   # Tab management UI
│   │   ├── TopBar.tsx     # Navigation controls
│   │   ├── AssistantPanel.tsx # Assistant sidebar
│   │   └── WebviewContainer.tsx # Webview management
│   ├── hooks/             # Custom React hooks
│   ├── types.ts           # TypeScript definitions
│   ├── App.tsx            # Main app component
│   └── styles.css         # Tailwind CSS imports
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── lib.rs        # Tauri app configuration
│   │   └── main.rs       # Entry point
│   ├── icons/            # App icons
│   └── tauri.conf.json   # Tauri configuration
└── package.json          # Node dependencies
```

## Development Setup

### Prerequisites

- Node.js 18+ and npm
- Rust toolchain (installed automatically by Tauri if needed)
- macOS, Windows, or Linux

### Installation

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run tauri dev
```

This will:
- Start Vite dev server on http://localhost:5173
- Compile the Rust backend
- Launch the desktop app with hot-reload

### Build for Production

```bash
npm run tauri build
```

## Scripts

- `npm run dev` - Start Vite dev server only
- `npm run build` - Build frontend for production
- `npm run tauri dev` - Run desktop app in development mode
- `npm run tauri build` - Build desktop app for distribution

## Known Issues & Limitations

### Multi-webview Rendering
The current implementation has a known issue where webviews may not render content properly. This is related to:
- Tauri v2's experimental multi-webview feature (see [issue #10011](https://github.com/tauri-apps/tauri/issues/10011))
- The webviews are created but may appear white/blank on initial load

### Potential Solutions
1. **Use IFrames Instead**: For MVP, consider using iframes within a single webview
2. **Single Webview with Tab Simulation**: Maintain one webview and swap URLs
3. **Wait for Tauri Updates**: The multi-webview API is still experimental

### Current Workarounds Attempted
- Enabled `unstable` feature in Tauri
- Implemented show/hide logic for webview switching
- Added proper webview lifecycle management

## Tailwind CSS Version Note

Originally specified to use Tailwind v4 with the Vite plugin, but due to compatibility issues with the current Vite version, we're using Tailwind v3 with PostCSS. The styling remains functionally equivalent.

To upgrade to Tailwind v4 in the future:
1. Update Vite to a compatible version
2. Install `@tailwindcss/vite` plugin
3. Update `vite.config.ts` to use the plugin
4. Update styles.css to use `@import "tailwindcss"`

## Security Notes

This is a prototype/MVP and does not include security hardening. For production use, consider:
- Implementing proper CSP policies
- Restricting webview permissions
- Adding URL validation and sanitization
- Implementing secure communication between webviews

## Contributing

This is an MVP prototype for demonstration purposes. The focus is on:
- Proving the multi-webview concept
- Creating a functional tabbed browser interface
- Establishing the foundation for the assistant panel

## License

MIT

## Acceptance Criteria Status

- ✅ New/close/switch tabs functionality
- ✅ Each tab has independent webview (created, but rendering issues)
- ✅ URL bar navigates the active webview
- ✅ Window resize maintains webview sizing
- ✅ Uses Tailwind CSS (v3 instead of v4 due to compatibility)
- ✅ Multi-webview implementation (experimental, with known issues)

## Next Steps

1. Resolve webview rendering issues
2. Implement webview navigation event listeners
3. Add tab title updates from page titles
4. Implement assistant panel functionality
5. Add keyboard shortcuts for tab management
6. Improve error handling and user feedback
