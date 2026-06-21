import type { ExportRequest } from "../electron/preload";
import type { RecordingSession } from "@autotype/core";

declare global {
  interface Window {
    autotype?: {
      openSession(): Promise<RecordingSession | null>;
      exportVideo(request: ExportRequest): Promise<{ path: string } | null>;
      onExportProgress(callback: (progress: number) => void): () => void;
    };
  }
}

export {};
