const { app, BrowserWindow, shell, ipcMain, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");
const isDev = process.env.ELECTRON_DEV === "1";

app.setAppUserModelId("com.gymz.oac");

let mainWindow;

function setAppMenu() {
  const template = [
    {
      label: "Gymz OAC",
      submenu: [
        { role: "about", label: "About Gymz OAC" },
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
    console.error("ERROR: OAC icon not found at build/icon.ico or build/icon.png");
    console.error("Run: npm run copy-icon (or npm run electron:build) to copy icons into build/");
    app.quit();
    return;
  }

  console.log(`[OAC] Using icon from: ${iconPath}`);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    icon: iconPath,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.setIcon(iconPath);

  if (isDev) {
    mainWindow.loadURL("http://localhost:8085");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

app.whenReady().then(() => {
  if (process.platform === "darwin") {
    const iconPath = path.join(__dirname, "..", "build", "icon.png");
    if (fs.existsSync(iconPath)) {
      const icon = nativeImage.createFromPath(iconPath);
      if (!icon.isEmpty()) {
        app.dock.setIcon(iconPath);
      }
    }
  }
  setAppMenu();
  createWindow();
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

ipcMain.handle("open-external", (_, url) => {
  if (typeof url === "string" && (url.startsWith("http://") || url.startsWith("https://"))) {
    shell.openExternal(url);
  }
});
