import type { ExportSettings } from "@autotype/core";

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  return `${minutes}:${remainder.toFixed(1).padStart(4, "0")}`;
}

export function dimensionsFor(resolution: ExportSettings["resolution"]): { width: number; height: number } {
  switch (resolution) {
    case "1440p": return { width: 2560, height: 1440 };
    case "4k": return { width: 3840, height: 2160 };
    case "vertical": return { width: 1080, height: 1920 };
    case "square": return { width: 1080, height: 1080 };
    default: return { width: 1920, height: 1080 };
  }
}
