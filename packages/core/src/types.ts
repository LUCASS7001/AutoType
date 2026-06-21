export const SESSION_VERSION = 1 as const;

export interface Position {
  line: number;
  column: number;
}

export interface Selection {
  anchor: Position;
  active: Position;
}

interface BaseEvent {
  id: string;
  time: number;
  file?: string;
}

export interface TextChangeEvent extends BaseEvent {
  type: "text-change";
  file: string;
  language: string;
  operation: "insert" | "delete" | "replace" | "paste";
  rangeOffset: number;
  rangeLength: number;
  text: string;
  start: Position;
  end: Position;
}

export interface SelectionEvent extends BaseEvent {
  type: "selection";
  file: string;
  selections: Selection[];
  reason?: "keyboard" | "mouse" | "command";
}

export interface ActiveEditorEvent extends BaseEvent {
  type: "active-editor";
  file: string;
  language: string;
  tabLabel: string;
}

export interface ViewportEvent extends BaseEvent {
  type: "viewport";
  file: string;
  topLine: number;
  bottomLine: number;
}

export interface DocumentEvent extends BaseEvent {
  type: "document-open" | "document-close" | "document-save";
  file: string;
  language: string;
  content?: string;
}

export interface FileCreateEvent extends BaseEvent {
  type: "file-create";
  file: string;
  language: string;
  content: string;
}

export interface FileRenameEvent extends BaseEvent {
  type: "file-rename";
  file: string;
  oldFile: string;
}

export interface FileDeleteEvent extends BaseEvent {
  type: "file-delete";
  file: string;
}

export type TimelineEvent =
  | TextChangeEvent
  | SelectionEvent
  | ActiveEditorEvent
  | ViewportEvent
  | DocumentEvent
  | FileCreateEvent
  | FileRenameEvent
  | FileDeleteEvent;

export interface SessionDocument {
  path: string;
  language: string;
  content: string;
}

export interface RecordingSession {
  version: typeof SESSION_VERSION;
  id: string;
  title: string;
  projectName: string;
  workspacePath?: string;
  startedAt: string;
  endedAt?: string;
  duration: number;
  initialDocuments: SessionDocument[];
  events: TimelineEvent[];
}

export interface ReplayDocument extends SessionDocument {
  exists: boolean;
  isOpen: boolean;
  isDirty: boolean;
}

export interface ReplayState {
  time: number;
  activeFile?: string;
  documents: Map<string, ReplayDocument>;
  selections: Map<string, Selection[]>;
  viewports: Map<string, { topLine: number; bottomLine: number }>;
}

export type CameraMode = "focus" | "smart-follow" | "ai-director" | "presentation";
export type DirectorPreset = "cursor" | "lovable" | "bolt" | "youtube" | "tiktok";
export type CameraTransition = "none" | "pan" | "file-switch" | "function-focus" | "reveal";

export interface CameraKeyframe {
  time: number;
  file?: string;
  focusLine: number;
  focusColumn: number;
  zoom: number;
  intensity: number;
  transition: CameraTransition;
  easing: "linear" | "ease-in-out" | "ease-out";
}

export interface CameraSample extends CameraKeyframe {
  progress: number;
}

export interface ExportSettings {
  format: "mp4" | "mov" | "webm";
  resolution: "1080p" | "1440p" | "4k" | "vertical" | "square";
  fps: 30 | 60;
}
