import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isDev = !app.isPackaged;
const devServerUrl = process.env.VITE_DEV_SERVER_URL ?? "http://localhost:5173";

const DEFAULT_BOUNDS = {
  width: 1120,
  height: 820,
  minWidth: 820,
  minHeight: 620,
};

const COMPACT_BOUNDS = {
  width: 420,
  height: 236,
};

const DEV_ICON_PATH = path.join(__dirname, "../build/icon.png");

let mainWindow: BrowserWindow | null = null;
let compactModeEnabled = false;

function sendCompactModeState(enabled: boolean) {
  BrowserWindow.getAllWindows().forEach((window) => {
    window.webContents.send("mini-mode:changed", enabled);
  });
}

function getPreloadPath() {
  return path.join(__dirname, "preload.cjs");
}

function getWindowIcon() {
  if (process.platform === "darwin") {
    return undefined;
  }

  return isDev ? DEV_ICON_PATH : undefined;
}

function loadRenderer(window: BrowserWindow) {
  if (isDev) {
    return window.loadURL(devServerUrl);
  }

  return window.loadFile(path.join(__dirname, "../dist/index.html"));
}

function applyCompactMode(enabled: boolean) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    compactModeEnabled = enabled;
    return enabled;
  }

  compactModeEnabled = enabled;
  mainWindow.setAlwaysOnTop(enabled, enabled ? "floating" : "normal");
  mainWindow.setResizable(!enabled);
  mainWindow.setMaximizable(!enabled);
  mainWindow.setFullScreenable(!enabled);

  if (enabled) {
    mainWindow.setMinimumSize(COMPACT_BOUNDS.width, COMPACT_BOUNDS.height);
    mainWindow.setSize(COMPACT_BOUNDS.width, COMPACT_BOUNDS.height, true);
    mainWindow.center();
  } else {
    mainWindow.setMinimumSize(DEFAULT_BOUNDS.minWidth, DEFAULT_BOUNDS.minHeight);
    mainWindow.setSize(DEFAULT_BOUNDS.width, DEFAULT_BOUNDS.height, true);
    mainWindow.center();
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();
  sendCompactModeState(enabled);
  return enabled;
}

function createMainWindow() {
  const window = new BrowserWindow({
    ...DEFAULT_BOUNDS,
    show: false,
    useContentSize: true,
    autoHideMenuBar: true,
    backgroundColor: "#eef2ff",
    icon: getWindowIcon(),
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.once("ready-to-show", () => {
    window.show();
    if (compactModeEnabled) {
      applyCompactMode(true);
    }
  });

  window.on("closed", () => {
    mainWindow = null;
  });

  loadRenderer(window);
  mainWindow = window;
  return window;
}

function showMainWindow() {
  const window = mainWindow ?? createMainWindow();
  if (window.isMinimized()) {
    window.restore();
  }
  window.show();
  window.focus();
}

app.whenReady().then(() => {
  if (isDev && process.platform === "darwin") {
    app.dock?.setIcon(DEV_ICON_PATH);
  }

  createMainWindow();

  ipcMain.on("window:show-main", () => {
    showMainWindow();
  });

  ipcMain.handle("window:toggle-mini-mode", () => {
    return applyCompactMode(!compactModeEnabled);
  });

  ipcMain.handle("window:get-mini-mode-enabled", () => {
    return compactModeEnabled;
  });

  ipcMain.handle("timer:play-sound", () => {
    shell.beep();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
      return;
    }

    showMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
