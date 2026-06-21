"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// electron/main.ts
var import_electron = require("electron");
var fs = __toESM(require("fs/promises"), 1);
var path = __toESM(require("path"), 1);
var mainWindow = null;
var remotionBundle;
function isRecordingSession(value) {
  if (!value || typeof value !== "object") return false;
  const session = value;
  return session.version === 1 && typeof session.id === "string" && Array.isArray(session.events) && Array.isArray(session.initialDocuments);
}
async function createWindow() {
  mainWindow = new import_electron.BrowserWindow({
    width: 1540,
    height: 980,
    minWidth: 1120,
    minHeight: 720,
    backgroundColor: "#101214",
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}
import_electron.ipcMain.handle("session:open", async () => {
  const result = await import_electron.dialog.showOpenDialog({
    title: "Open AutoType recording",
    properties: ["openFile"],
    filters: [{ name: "AutoType Session", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePaths[0]) return null;
  try {
    const parsed = JSON.parse(await fs.readFile(result.filePaths[0], "utf8"));
    if (!isRecordingSession(parsed)) throw new Error("This file is not an AutoType Recorder v1 session.");
    return parsed;
  } catch (error) {
    await import_electron.dialog.showMessageBox({ type: "error", title: "Could not open session", message: error instanceof Error ? error.message : String(error) });
    return null;
  }
});
import_electron.ipcMain.handle("video:export", async (_event, request) => {
  const extension = request.settings.format;
  const result = await import_electron.dialog.showSaveDialog({
    title: "Export cinematic recording",
    defaultPath: `${request.session.projectName.replace(/[^a-z0-9-_]+/gi, "-")}.${extension}`,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }]
  });
  if (result.canceled || !result.filePath) return null;
  const [{ bundle }, { renderMedia, selectComposition }] = await Promise.all([
    import("@remotion/bundler"),
    import("@remotion/renderer")
  ]);
  if (!remotionBundle) {
    const entry = process.env.VITE_DEV_SERVER_URL ? path.resolve(process.cwd(), "src/remotion/index.tsx") : path.join(import_electron.app.getAppPath(), "src/remotion/index.tsx");
    remotionBundle = await bundle({ entryPoint: entry, onProgress: (progress) => mainWindow?.webContents.send("video:progress", progress * 0.12) });
  }
  const inputProps = request;
  const composition = await selectComposition({ serveUrl: remotionBundle, id: "AutoTypeRecording", inputProps });
  const codec = request.settings.format === "webm" ? "vp8" : request.settings.format === "mov" ? "prores" : "h264";
  await renderMedia({
    composition,
    serveUrl: remotionBundle,
    codec,
    outputLocation: result.filePath,
    inputProps,
    onProgress: ({ progress }) => mainWindow?.webContents.send("video:progress", 0.12 + progress * 0.88)
  });
  return { path: result.filePath };
});
import_electron.app.whenReady().then(async () => {
  await createWindow();
  import_electron.app.on("activate", async () => {
    if (import_electron.BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});
import_electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") import_electron.app.quit();
});
//# sourceMappingURL=main.cjs.map