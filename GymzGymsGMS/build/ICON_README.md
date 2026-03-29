# Gymz App Icon (Electron / Windows)

**Strictly uses Gymz logo – never the default Electron icon or name.**

## Overview

The `electron:dev` and `electron:build` scripts automatically:

1. Copy the Gymz logo (ONLY from `image_assets/gymzLogo.png`) to:
   - `public/gymzLogo.png` (web UI / Vite)
   - `build/icon.png` (Electron build resources)
2. Convert to `build/icon.ico` (multi-size ICO) for Windows
3. Verify icons exist before building
4. After packaging, set the .exe icon and Windows metadata (ProductName,
   FileDescription) to **Gymz** so the app never shows "Electron" in Properties
   or taskbar

**Required:** Place your Gymz logo at `image_assets/gymzLogo.png` (512×512 minimum).
This project is locked to a single source of truth — there are no fallbacks.

## Icon Usage

The Gymz logo is used for ALL application icons:

- **Application window** (title bar icon)
- **Windows taskbar** (via `app.setAppUserModelId`)
- **Desktop shortcut** (after installation)
- **Start menu shortcut** (after installation)
- **Windows installer** (NSIS installer icon)
- **Executable file** (Gymz.exe icon)
- **System tray** (if applicable)

## Build Process

1. `copy-gymz-icon.cjs` runs automatically before Electron starts
2. Creates `build/icon.png` and `build/icon.ico` from Gymz logo
3. `verify-icons.cjs` checks icons exist before `electron-builder` runs
4. `electron-builder` uses `build/icon.ico` for all Windows icons
5. `main.cjs` sets `app.setAppUserModelId` to ensure taskbar uses Gymz logo

## Verification

Run `npm run electron:build:verify` to check icons before building.

## Troubleshooting

If Electron default icon or "Electron" name appears:

1. Check `image_assets/gymzLogo.png` exists
2. Run `node scripts/copy-gymz-icon.cjs` manually
3. Verify `public/gymzLogo.png` exists and `build/icon.ico` exists and is > 1KB
4. Run a full `npm run electron:build` so the after-pack hook and post-build
   script set the .exe icon and metadata (ProductName, FileDescription)
5. If the exe was already built, close the app and run:
   - `node scripts/post-build-icon-fix.cjs`
   - to fix metadata on `release/win-unpacked/Gymz.exe`
6. Ensure `package.json` build.win.icon points to `build/icon.ico` and
   build.productName is "Gymz"

## Windows installer: "Cannot create symbolic link" (winCodeSign)

If `npm run electron:build` fails with **ERROR: Cannot create symbolic link : A
required privilege is not held by the client** when extracting winCodeSign:

- **Unpacked app is still built.** Run the app from:
  - `release\win-unpacked\Gymz.exe` (no installer needed for testing).
- **To produce the NSIS installer (.exe setup):**
  1. **Developer Mode:** Settings → Privacy & security → For developers → turn
     **Developer Mode** On (allows symlinks without admin), then run
     `npm run electron:build` again, or
  2. **Run as Administrator:** Open PowerShell or CMD as Administrator, `cd` to
     this project, run `npm run electron:build`.
