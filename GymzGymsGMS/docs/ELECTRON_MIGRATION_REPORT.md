# Electron Migration Report – Gymz Desktop App

## 1. Summary

The existing React + Vite + TypeScript gym management web app (GymzGymsGMS) was
already wrapped with Electron. This migration report documents the updates made
to align with the specified requirements:

- **Electron wrapper**: Main and preload scripts in `/electron`
- **Branding**: Product name set to "Gymz" (was "GMS"), app ID `com.gymz.gymmanagement`
- **Logo**: Strictly uses Gymz logo (never default Electron icon).
  `public/gymzLogo.png` is auto-copied to `build/icon.png` before Electron runs.
- **Installer**: Windows NSIS installer via electron-builder
- **Security**: `contextIsolation: true`, `nodeIntegration: false`, no remote
  module, minimal preload API

**Note**: Vite dev server uses port **8080** (not 5173). Electron dev mode loads
`http://localhost:8080`.

---

## 2. Files Changed / Created

| Path | Purpose |
| ---- | ------- |
| `package.json` | `appId`, `productName`→Gymz, `build.files`, `win.icon` |
| `electron/main.cjs` | Menu "GMS"→"Gymz", icon `build/icon.ico` |
| `electron/preload.cjs` | `desktop.ping()`, `electronAPI.openExternal` |
| `index.html` | Title "GMS" → "Gymz" |
| `build/ICON_README.md` | Gymz logo (auto-copy from `public/gymzLogo.png`) |
| `copy-gymz-icon.cjs` | **Created** – Copies logo to `build/icon.png` |

---

## 3. Commands to Run

### Dev (Electron + Vite)

```bash
cd GymzGymsGMS
npm install
npm run electron:dev
```

- Starts Vite dev server on port 8080
- Waits for it to be ready, then launches Electron
- Electron loads `http://localhost:8080` with hot reload

### Build Windows Installer

```bash
cd GymzGymsGMS
npm install
npm run electron:build
```

- Runs `vite build` (output to `dist/`)
- Runs `electron-builder` for Windows NSIS

---

## 4. Output Installer Location

```text
GymzGymsGMS/release/
```

- Installer: `Gymz Setup X.X.X.exe` (or similar)
- Unpacked app: `Gymz X.X.X.exe` in `release/win-unpacked/`

---

## 5. Verification Checklist

### 5.1 Dev Run

- [ ] `npm install` completes without errors
- [ ] `npm run electron:dev` starts Vite and Electron
- [ ] Electron window loads the app from `http://localhost:8080`
- [ ] Hot reload works when editing source files

### 5.2 Production Build

- [ ] `npm run electron:build` completes without errors
- [ ] `release/` contains `Gymz Setup X.X.X.exe`
- [ ] Run the installer and launch the app
- [ ] App loads from local `dist/index.html` (no localhost requests)
- [ ] DevTools Network tab shows no `localhost` or `127.0.0.1` in production

### 5.3 Web Mode Still Works

- [ ] `npm run dev` starts the Vite web app as before
- [ ] `npm run build` produces a working web build in `dist/`
- [ ] `npm run preview` serves the built web app

### 5.4 Gymz Logo (Required)

- [ ] Ensure `public/gymzLogo.png` exists (favicon, GymzLogo, Electron)
- [ ] `electron:dev` and `electron:build` auto-copy to `build/icon.png`
- [ ] If logo missing, commands fail (never uses default Electron icon)

---

## 6. Security Configuration (Verified)

| Setting | Value |
| ------- | ----- |
| `contextIsolation` | `true` |
| `nodeIntegration` | `false` |
| Remote module | Not used |
| Preload API | `desktop.ping()`, `electronAPI.openExternal` (URL validated) |

---

## 7. Vite Output Directory

**Verified**: Vite uses default output directory `dist/` (no custom `outDir` in
`vite.config.ts`).
