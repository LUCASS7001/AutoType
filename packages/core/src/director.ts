import type {
  CameraKeyframe,
  CameraMode,
  CameraSample,
  DirectorPreset,
  RecordingSession,
  TimelineEvent,
} from "./types";

interface DirectorStyle {
  baseZoom: number;
  editZoom: number;
  functionZoom: number;
  pasteZoom: number;
  minGap: number;
  intensity: number;
}

const STYLES: Record<DirectorPreset, DirectorStyle> = {
  cursor: { baseZoom: 1.08, editZoom: 1.28, functionZoom: 1.2, pasteZoom: 1, minGap: 0.55, intensity: 0.8 },
  lovable: { baseZoom: 1.05, editZoom: 1.18, functionZoom: 1.14, pasteZoom: 1, minGap: 1.1, intensity: 0.45 },
  bolt: { baseZoom: 1.08, editZoom: 1.3, functionZoom: 1.22, pasteZoom: 0.96, minGap: 0.65, intensity: 0.9 },
  youtube: { baseZoom: 1, editZoom: 1.08, functionZoom: 1.06, pasteZoom: 0.98, minGap: 1.8, intensity: 0.25 },
  tiktok: { baseZoom: 1.22, editZoom: 1.55, functionZoom: 1.4, pasteZoom: 1.08, minGap: 0.4, intensity: 1 },
};

function focusForEvent(event: TimelineEvent): { line: number; column: number } {
  if (event.type === "text-change") return event.start;
  if (event.type === "selection") return event.selections[0]?.active ?? { line: 0, column: 0 };
  if (event.type === "viewport") {
    return { line: Math.round((event.topLine + event.bottomLine) / 2), column: 0 };
  }
  return { line: 0, column: 0 };
}

function classify(event: TimelineEvent, style: DirectorStyle, mode: CameraMode): CameraKeyframe {
  const focus = focusForEvent(event);
  let zoom = style.baseZoom;
  let transition: CameraKeyframe["transition"] = "pan";
  let intensity = style.intensity;

  if (event.type === "active-editor" || event.type === "file-create") {
    transition = "file-switch";
    zoom = style.baseZoom;
  } else if (event.type === "text-change") {
    const isLargeChange = event.text.length + event.rangeLength > 100;
    const createsFunction = /(?:function\s+\w+|(?:const|let)\s+\w+\s*=\s*(?:async\s*)?\(|class\s+\w+)/.test(event.text);
    zoom = isLargeChange ? style.pasteZoom : createsFunction ? style.functionZoom : style.editZoom;
    transition = createsFunction ? "function-focus" : "pan";
  }

  if (mode === "presentation") {
    zoom = Math.min(1.05, zoom);
    intensity *= 0.35;
  } else if (mode === "focus") {
    zoom = Math.min(1.18, zoom);
    intensity *= 0.55;
  } else if (mode === "smart-follow") {
    zoom = Math.min(1.25, zoom);
    intensity *= 0.75;
  }

  return {
    time: event.time,
    file: event.file,
    focusLine: focus.line,
    focusColumn: focus.column,
    zoom,
    intensity,
    transition,
    easing: transition === "file-switch" ? "ease-out" : "ease-in-out",
  };
}

export function directSession(
  session: RecordingSession,
  mode: CameraMode,
  preset: DirectorPreset,
): CameraKeyframe[] {
  const style = STYLES[preset];
  const candidates = session.events.filter((event) =>
    ["text-change", "selection", "active-editor", "file-create", "viewport"].includes(event.type),
  );
  const frames: CameraKeyframe[] = [
    {
      time: 0,
      file: session.initialDocuments[0]?.path,
      focusLine: 0,
      focusColumn: 0,
      zoom: style.baseZoom,
      intensity: 0,
      transition: "reveal",
      easing: "ease-out",
    },
  ];

  for (const event of candidates) {
    const keyframe = classify(event, style, mode);
    const previous = frames.at(-1)!;
    const sameRegion = previous.file === keyframe.file && Math.abs(previous.focusLine - keyframe.focusLine) < 3;
    if (sameRegion && keyframe.time - previous.time < style.minGap) {
      frames[frames.length - 1] = { ...keyframe, time: previous.time };
    } else {
      frames.push(keyframe);
    }
  }
  return frames;
}

const ease = (value: number, easing: CameraKeyframe["easing"]): number => {
  if (easing === "linear") return value;
  if (easing === "ease-out") return 1 - Math.pow(1 - value, 3);
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
};

export function sampleCamera(keyframes: CameraKeyframe[], time: number): CameraSample {
  const nextIndex = keyframes.findIndex((frame) => frame.time > time);
  const next = nextIndex === -1 ? keyframes.at(-1)! : keyframes[nextIndex]!;
  const previous = nextIndex <= 0 ? keyframes[0]! : keyframes[nextIndex - 1]!;
  const span = Math.max(0.001, next.time - previous.time);
  const rawProgress = Math.max(0, Math.min(1, (time - previous.time) / span));
  const progress = ease(rawProgress, next.easing);
  const lerp = (from: number, to: number) => from + (to - from) * progress;

  return {
    ...next,
    file: progress < 0.5 ? previous.file : next.file,
    focusLine: lerp(previous.focusLine, next.focusLine),
    focusColumn: lerp(previous.focusColumn, next.focusColumn),
    zoom: lerp(previous.zoom, next.zoom),
    intensity: lerp(previous.intensity, next.intensity),
    progress,
  };
}
