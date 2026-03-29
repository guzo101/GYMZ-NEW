const { app, BrowserWindow, shell, ipcMain, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = process.env.ELECTRON_DEV === "1";

// Set Application User Model ID for Windows taskbar icon
// This MUST match the appId in package.json build config
// Without this, Windows may show the default Electron icon in taskbar
app.setAppUserModelId("com.gymz.gymmanagement");

// Register gymz:// protocol so password reset links open the app instead of browser
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("gymz", process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient("gymz");
}

let mainWindow;
let autoUpdater;
if (!isDev) {
  try {
    autoUpdater = require("electron-updater").autoUpdater;
  } catch (_) { }
}

function setAppMenu() {
  const template = [
    {
      label: "Gymz",
      submenu: [
        { role: "about", label: "About Gymz" },
        { type: "separator" },
        { role: "quit", label: "Quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo", label: "Undo" },
        { role: "redo", label: "Redo" },
        { type: "separator" },
        { role: "cut", label: "Cut" },
        { role: "copy", label: "Copy" },
        { role: "paste", label: "Paste" },
        { role: "selectAll", label: "Select All" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload", label: "Reload" },
        { role: "forceReload", label: "Force Reload" },
        { type: "separator" },
        { role: "resetZoom", label: "Reset Zoom" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Toggle Full Screen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize", label: "Minimize" },
        { role: "close", label: "Close" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Gymz Website",
          click: () => shell.openExternal("https://gymz.app"),
        },
      ],
    },
  ];
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

function createWindow() {
  // CRITICAL: Always use Gymz logo - never allow Electron default icon
  const iconIco = path.join(__dirname, "..", "build", "icon.ico");
  const iconPng = path.join(__dirname, "..", "build", "icon.png");
  
  let iconPath = null;
  let iconImage = null;
  
  if (fs.existsSync(iconIco)) {
    iconPath = iconIco;
    iconImage = nativeImage.createFromPath(iconIco);
  } else if (fs.existsSync(iconPng)) {
    iconPath = iconPng;
    iconImage = nativeImage.createFromPath(iconPng);
  }
  
  if (!iconPath || !iconImage || iconImage.isEmpty()) {
    console.error("ERROR: Gymz logo not found or invalid at build/icon.ico or build/icon.png");
    console.error("Run: npm run electron:dev or npm run electron:build");
    console.error("This ensures the Gymz logo is copied to build/ before Electron starts.");
    app.quit();
    return;
  }
  
  // Verify we're using Gymz logo, not Electron default
  console.log(`[Icon] Using Gymz logo from: ${iconPath}`);
  
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: iconPath, // Window icon (title bar, taskbar)
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });
  
  // Explicitly set window icon again to ensure it's applied
  mainWindow.setIcon(iconPath);

  // Explicitly handles permissions for camera/hardware access in the installed app
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowedPermissions = ["media", "camera", "microphone"];
    if (allowedPermissions.includes(permission)) {
      console.log(`[Electron] Auto-granting permission: ${permission}`);
      return callback(true);
    }
    callback(false);
  });

  mainWindow.webContents.session.setPermissionCheckHandler((webContents, permission, origin, details) => {
    const allowedPermissions = ["media", "camera", "microphone"];
    if (allowedPermissions.includes(permission)) {
      return true;
    }
    return false;
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:8080");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  if (autoUpdater) {
    autoUpdater.logger = console;

    autoUpdater.on("checking-for-update", () => {
      console.log("[AutoUpdater] Checking for update...");
    });

    autoUpdater.on("update-available", (info) => {
      console.log("[AutoUpdater] Update available:", info.version);
    });

    autoUpdater.on("update-not-available", (info) => {
      console.log("[AutoUpdater] Update not available.");
    });

    autoUpdater.on("error", (err) => {
      console.error("[AutoUpdater] Error in auto-updater:", err);
    });

    autoUpdater.on("download-progress", (progressObj) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond;
      log_message = log_message + " - Downloaded " + progressObj.percent + "%";
      log_message = log_message + " (" + progressObj.transferred + "/" + progressObj.total + ")";
      console.log("[AutoUpdater] " + log_message);
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log("[AutoUpdater] Update downloaded. Will install now.");
      autoUpdater.quitAndInstall();
    });

    autoUpdater.checkForUpdatesAndNotify();
  }
}

function sendDeepLinkToRenderer(url) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("deep-link", url);
  }
}

// Single instance lock: when user clicks gymz:// link, focus existing app instead of opening a new one
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // On Windows/Linux, the deep link URL is passed as the last command-line argument
    const url = commandLine.find((arg) => arg.startsWith("gymz://"));
    if (url) sendDeepLinkToRenderer(url);
  });
}

app.whenReady().then(() => {
  // Set application icon for macOS dock (if on macOS)
  // Windows uses app.setAppUserModelId (set earlier) and BrowserWindow icon
  // Linux uses BrowserWindow icon
  if (process.platform === "darwin") {
    const iconPath = path.join(__dirname, "..", "build", "icon.png");
    if (fs.existsSync(iconPath)) {
      const { nativeImage } = require("electron");
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        app.dock.setIcon(iconPath);
      }
    }
  }
  
  setAppMenu();
  createWindow();
  // If app was launched from a gymz:// link (e.g. first launch), the URL may be in argv
  const launchUrl = process.argv.find((arg) => arg.startsWith("gymz://"));
  if (launchUrl) {
    setTimeout(() => sendDeepLinkToRenderer(launchUrl), 1000);
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// macOS: handle gymz:// links when app is already open
app.on("open-url", (event, url) => {
  event.preventDefault();
  sendDeepLinkToRenderer(url);
});

ipcMain.handle("open-external", (_, url) => {
  if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
    shell.openExternal(url);
  }
});
