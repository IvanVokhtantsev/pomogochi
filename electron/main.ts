import { app, BrowserWindow, ipcMain, screen, shell } from "electron";
import type { Rectangle } from "electron";
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
  width: 360,
  height: 150,
};

const DEV_ICON_PATH = path.join(__dirname, "../build/icon.png");

type AttentionRestoreState = {
  compactModeEnabled: boolean;
  bounds: Rectangle;
  isFullScreen: boolean;
  isMaximized: boolean;
  isSimpleFullScreen: boolean;
};

let mainWindow: BrowserWindow | null = null;
let compactModeEnabled = false;
let attentionRestoreState: AttentionRestoreState | null = null;

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
  mainWindow.setMinimizable(!enabled);
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

function enterTimerAttentionMode() {
  const window = mainWindow ?? createMainWindow();

  if (!attentionRestoreState) {
    attentionRestoreState = {
      compactModeEnabled,
      bounds: window.getBounds(),
      isFullScreen: window.isFullScreen(),
      isMaximized: window.isMaximized(),
      isSimpleFullScreen: window.isSimpleFullScreen(),
    };
  }

  const display = screen.getDisplayMatching(window.getBounds());

  window.setResizable(true);
  window.setMaximizable(true);
  window.setMinimizable(false);
  window.setFullScreenable(true);
  window.setMinimumSize(360, 220);
  window.setAlwaysOnTop(true, "screen-saver");

  if (window.isMinimized()) {
    window.restore();
  }

  if (process.platform === "darwin") {
    window.setSimpleFullScreen(true);
  } else {
    window.setBounds(display.bounds, true);
    window.setFullScreen(true);
  }

  window.show();
  window.focus();
  window.webContents.focus();
  window.moveTop();

  setTimeout(() => {
    if (window.isDestroyed()) {
      return;
    }

    window.show();
    window.focus();
    window.webContents.focus();
    window.moveTop();
  }, 280);
}

function restoreFromTimerAttentionMode() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    attentionRestoreState = null;
    return;
  }

  const restoreState = attentionRestoreState;
  attentionRestoreState = null;

  if (!restoreState) {
    return;
  }

  if (mainWindow.isSimpleFullScreen() && !restoreState.isSimpleFullScreen) {
    mainWindow.setSimpleFullScreen(false);
  }

  if (mainWindow.isFullScreen() && !restoreState.isFullScreen) {
    mainWindow.setFullScreen(false);
  }

  if (restoreState.compactModeEnabled) {
    applyCompactMode(true);
    return;
  }

  compactModeEnabled = false;
  mainWindow.setAlwaysOnTop(false, "normal");
  mainWindow.setResizable(true);
  mainWindow.setMaximizable(true);
  mainWindow.setMinimizable(true);
  mainWindow.setFullScreenable(true);
  mainWindow.setMinimumSize(DEFAULT_BOUNDS.minWidth, DEFAULT_BOUNDS.minHeight);

  if (restoreState.isMaximized) {
    mainWindow.maximize();
  } else {
    mainWindow.setBounds(restoreState.bounds, true);
  }

  mainWindow.show();
  mainWindow.focus();
  sendCompactModeState(false);
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

  ipcMain.handle("timer:enter-attention-mode", () => {
    enterTimerAttentionMode();
  });

  ipcMain.handle("timer:restore-from-attention-mode", () => {
    restoreFromTimerAttentionMode();
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
