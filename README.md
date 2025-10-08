# AI Web Dev Assistant

Local-first AI-like assistant for generating front-end (and basic back-end scaffolds) without external API calls. Currently uses a rule/template engine in the browser to simulate responses while providing code generation, explanation, debugging help, optimization pointers, Power Fx guidance, and full-site scaffolding.

## Features
- Chat style UX with modes: Generate, Explain, Debug, Optimize, Power Fx, Full Site
- Session memory toggle (local only)
- Snippet toolbar, image reference tokens, voice input (if supported), speech synthesis of replies
- Lightweight markdown + custom syntax highlighting (no external libs)
- Live multi-file site preview (Full Site mode) with ability to copy individual generated files
- Beginner vs Expert presentation toggle
- Tailwind preference hinting for site generation

## Planned / Roadmap
- Client-side ZIP export (JSZip) or server /api/zip generation
- GitHub export integration
- React & Vue template generation
- Auth starter (JWT / session) scaffolds
- Lint / format suggestions

## Running (optional server)
```bash
npm install
npm run dev
# Open http://localhost:3000 in your browser
```
You can also just open `index.html` directly for pure front-end usage.

## Desktop (Electron) App
Build a Windows desktop executable with installer & shortcut (uses electron-builder):

```bash
npm install
npm run electron   # launches the app in development
npm run dist       # builds signed/unsigned installer (unsigned by default)
```

Artifacts will appear in `dist/` once the build completes. The NSIS installer creates Start Menu and Desktop shortcuts named "AI Web Dev Assistant".

### Custom Icon
Place your branding image at `SMAiAssistant.png` (recommended 512x512). The build script converts it into a multi-size `build/icon.ico` automatically each time you run a packaging script. If absent, a placeholder icon is generated.

To build for other OS targets (on their respective platforms or with proper cross-build tooling):

```bash
npm run dist:all   # attempts win/mac/linux (requires additional system setup)
```

If you only need a unpacked directory for quick testing:

```bash
npm run pack
```

### Code Signing (Optional)
Add environment variables or configure `build.win.certificateFile` / `build.afterSign` hooks for production signing. For internal use you can distribute the unsigned installer; Windows SmartScreen may warn users.

### Auto Update (Future)
You can integrate auto-updates via `electron-updater` later. This project is currently offline/local-first.

## Security Note
No network calls to external AI APIs are made. Replace `mockRespond` with real API integration when ready.

## License
MIT
