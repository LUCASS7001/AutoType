import { contextBridge, ipcRenderer } from "electron";
import type { ExportSettings, RecordingSession } from "@autotype/core";

export interface ExportRequest extends Record<string, unknown> {
  session: RecordingSession;
  cameraMode: "focus" | "smart-follow" | "ai-director" | "presentation";
  preset: "cursor" | "lovable" | "bolt" | "youtube" | "tiktok";
  theme: string;
  settings: ExportSettings;
}

contextBridge.exposeInMainWorld("autotype", {
  openSession: (): Promise<RecordingSession | null> => ipcRenderer.invoke("session:open"),
  exportVideo: (request: ExportRequest): Promise<{ path: string } | null> => ipcRenderer.invoke("video:export", request),
  onExportProgress: (callback: (progress: number) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, progress: number) => callback(progress);
    ipcRenderer.on("video:progress", listener);
    return () => ipcRenderer.removeListener("video:progress", listener);
  },
});
