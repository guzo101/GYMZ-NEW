# GMS Desktop (Electron)

GMS runs as an installable desktop app on Windows via Electron.

## Quick Start

```bash
# Development (Vite dev server + Electron)
npm run electron:dev

# Build installer
npm run electron:build
```

## Output

- **Installer:** `release/GMS Setup 0.0.0.exe`
- **Portable:** `release/win-unpacked/GMS.exe`

## Requirements

- Node.js 18+
- Windows 10/11 (for Windows build)

## Notes

- Dev server uses port **8080**
- Code signing is disabled; for signed builds, run as Administrator or enable Developer Mode
- Add `build/icon.ico` (256×256) for custom app icon
