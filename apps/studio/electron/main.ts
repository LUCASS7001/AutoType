import { app, BrowserWindow, dialog, ipcMain } from "electron";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { RecordingSession } from "@autotype/core";
import type { ExportRequest } from "./preload";

let mainWindow: BrowserWindow | null = null;
let remotionBundle: string | undefined;

function isRecordingSession(value: unknown): value is RecordingSession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<RecordingSession>;
  return session.version === 1 && typeof session.id === "string" && Array.isArray(session.events) && Array.isArray(session.initialDocuments);
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
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
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

ipcMain.handle("session:open", async () => {
  const result = await dialog.showOpenDialog({
    title: "Open AutoType recording",
    properties: ["openFile"],
    filters: [{ name: "AutoType Session", extensions: ["json"] }],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  try {
    const parsed: unknown = JSON.parse(await fs.readFile(result.filePaths[0], "utf8"));
    if (!isRecordingSession(parsed)) throw new Error("This file is not an AutoType Recorder v1 session.");
    return parsed;
  } catch (error) {
    await dialog.showMessageBox({ type: "error", title: "Could not open session", message: error instanceof Error ? error.message : String(error) });
    return null;
  }
});

ipcMain.handle("video:export", async (_event, request: ExportRequest) => {
  const extension = request.settings.format;
  const result = await dialog.showSaveDialog({
    title: "Export cinematic recording",
    defaultPath: `${request.session.projectName.replace(/[^a-z0-9-_]+/gi, "-")}.${extension}`,
    filters: [{ name: extension.toUpperCase(), extensions: [extension] }],
  });
  if (result.canceled || !result.filePath) return null;

  const [{ bundle }, { renderMedia, selectComposition }] = await Promise.all([
    import("@remotion/bundler"),
    import("@remotion/renderer"),
  ]);
  if (!remotionBundle) {
    const entry = process.env.VITE_DEV_SERVER_URL
    ? path.resolve(process.cwd(), "src/remotion/index.tsx")
    : path.join(app.getAppPath(), "src/remotion/index.tsx");
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
    onProgress: ({ progress }) => mainWindow?.webContents.send("video:progress", 0.12 + progress * 0.88),
  });
  return { path: result.filePath };
});

app.whenReady().then(async () => {
  await createWindow();
  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
