import Editor, { loader, type OnMount } from "@monaco-editor/react";
import * as monacoRuntime from "monaco-editor";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import CssWorker from "monaco-editor/esm/vs/language/css/css.worker?worker";
import HtmlWorker from "monaco-editor/esm/vs/language/html/html.worker?worker";
import JsonWorker from "monaco-editor/esm/vs/language/json/json.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import {
  ChevronDown,
  ChevronRight,
  Circle,
  Clapperboard,
  Download,
  FileCode2,
  FolderOpen,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  directSession,
  sampleCamera,
  TimelineEngine,
  type CameraMode,
  type DirectorPreset,
  type ExportSettings,
  type RecordingSession,
  type ReplayDocument,
} from "@autotype/core";
import { dimensionsFor, formatTime } from "./lib/format";
import { sampleSession } from "./lib/sampleSession";
import { registerThemes, themeId, THEMES } from "./lib/themes";

loader.config({ monaco: monacoRuntime });
(globalThis as typeof globalThis & { MonacoEnvironment: { getWorker(_: string, label: string): Worker } }).MonacoEnvironment = {
  getWorker: (_moduleId, label) => {
    if (label === "json") return new JsonWorker();
    if (["css", "scss", "less"].includes(label)) return new CssWorker();
    if (["html", "handlebars", "razor"].includes(label)) return new HtmlWorker();
    if (["typescript", "javascript"].includes(label)) return new TypeScriptWorker();
    return new EditorWorker();
  },
};

const CAMERA_MODES: { value: CameraMode; label: string }[] = [
  { value: "focus", label: "Focus" },
  { value: "smart-follow", label: "Follow" },
  { value: "ai-director", label: "AI Director" },
  { value: "presentation", label: "Present" },
];

const PRESETS: { value: DirectorPreset; label: string; detail: string }[] = [
  { value: "cursor", label: "Cursor Demo", detail: "Fast, precise focus" },
  { value: "lovable", label: "Lovable Demo", detail: "Calm and elegant" },
  { value: "bolt", label: "Bolt Demo", detail: "Dynamic launch energy" },
  { value: "youtube", label: "YouTube Tutorial", detail: "Stable and readable" },
  { value: "tiktok", label: "TikTok Coding", detail: "Tight, high energy" },
];

const EVENT_COLORS: Record<string, string> = {
  "text-change": "#63d6a6",
  selection: "#6cb6ff",
  "active-editor": "#f4c95d",
  "file-create": "#e785ff",
  "document-save": "#88929d",
  viewport: "#4d6675",
};

function basename(file: string): string {
  return file.split("/").at(-1) ?? file;
}

function languageFor(document: ReplayDocument | undefined): string {
  if (!document) return "plaintext";
  const aliases: Record<string, string> = { ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", py: "python" };
  return aliases[document.language] ?? document.language;
}

interface CodePreviewProps {
  document?: ReplayDocument;
  focusLine: number;
  focusColumn: number;
  zoom: number;
  theme: string;
  aspect: string;
  onReady: OnMount;
}

function CodePreview({ document, focusLine, focusColumn, zoom, theme, aspect, onReady }: CodePreviewProps) {
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const mount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    onReady(editor, monaco);
  };

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const line = Math.max(1, Math.round(focusLine) + 1);
    editor.revealLineInCenter(line, 1);
    editor.setPosition({ lineNumber: line, column: Math.max(1, Math.round(focusColumn) + 1) });
  }, [focusColumn, focusLine]);

  return (
    <div className="stage-shell" style={{ aspectRatio: aspect }}>
      <div className="window-chrome">
        <div className="traffic-lights"><span /><span /><span /></div>
        <div className="chrome-title">{document ? basename(document.path) : "No active file"}</div>
        <div className="chrome-spacer" />
      </div>
      <div className="editor-viewport">
        <div className="editor-camera" style={{ transform: `scale(${zoom})` }}>
          <Editor
            height="100%"
            path={document?.path ?? "untitled.txt"}
            language={languageFor(document)}
            value={document?.content ?? ""}
            theme={themeId(theme)}
            beforeMount={registerThemes}
            onMount={mount}
            options={{
              readOnly: true,
              domReadOnly: true,
              fontFamily: "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
              fontSize: 18,
              lineHeight: 29,
              fontLigatures: true,
              minimap: { enabled: false },
              overviewRulerLanes: 0,
              renderLineHighlight: "all",
              renderWhitespace: "none",
              scrollBeyondLastLine: false,
              smoothScrolling: true,
              cursorBlinking: "solid",
              cursorStyle: "line",
              padding: { top: 26, bottom: 26 },
              lineNumbersMinChars: 3,
              folding: false,
              glyphMargin: false,
              wordWrap: "off",
              hideCursorInOverviewRuler: true,
              scrollbar: { vertical: "hidden", horizontal: "hidden", alwaysConsumeMouseWheel: false },
            }}
          />
        </div>
      </div>
      <div className="stage-badge"><Sparkles size={13} /> AI DIRECTED</div>
    </div>
  );
}

export function App() {
  const [session, setSession] = useState<RecordingSession>(sampleSession);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [cameraMode, setCameraMode] = useState<CameraMode>("ai-director");
  const [preset, setPreset] = useState<DirectorPreset>("lovable");
  const [theme, setTheme] = useState<string>("GitHub Dark");
  const [settings, setSettings] = useState<ExportSettings>({ format: "mp4", resolution: "1080p", fps: 60 });
  const [exportProgress, setExportProgress] = useState<number | null>(null);
  const [notice, setNotice] = useState("Demo session loaded");
  const timeline = useMemo(() => new TimelineEngine(session), [session]);
  const keyframes = useMemo(() => directSession(session, cameraMode, preset), [cameraMode, preset, session]);
  const replay = useMemo(() => timeline.getStateAt(time), [time, timeline]);
  const camera = useMemo(() => sampleCamera(keyframes, time), [keyframes, time]);
  const activeDocument = replay.activeFile ? replay.documents.get(replay.activeFile) : undefined;
  const dimensions = dimensionsFor(settings.resolution);
  const aspect = `${dimensions.width} / ${dimensions.height}`;

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let previous = performance.now();
    const tick = (now: number) => {
      const delta = ((now - previous) / 1000) * speed;
      previous = now;
      setTime((current) => {
        const next = current + delta;
        if (next >= timeline.duration) {
          setPlaying(false);
          return timeline.duration;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, speed, timeline]);

  useEffect(() => window.autotype?.onExportProgress((progress) => setExportProgress(progress)) ?? (() => undefined), []);

  const openSession = async () => {
    const opened = await window.autotype?.openSession();
    if (!opened) return;
    setPlaying(false);
    setTime(0);
    setSession(opened);
    setNotice(`${opened.events.length} intent events loaded`);
  };

  const exportVideo = async () => {
    if (!window.autotype) {
      setNotice("Video export is available in the Electron desktop app");
      return;
    }
    setPlaying(false);
    setExportProgress(0);
    try {
      const result = await window.autotype.exportVideo({ session, cameraMode, preset, theme, settings });
      setNotice(result ? `Exported ${basename(result.path)}` : "Export cancelled");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Export failed");
    } finally {
      setExportProgress(null);
    }
  };

  const togglePlayback = () => {
    if (time >= timeline.duration) setTime(0);
    setPlaying((current) => !current);
  };

  const files = [...replay.documents.values()].filter((document) => document.exists);

  return (
    <main className="app-frame">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Clapperboard size={17} /></span><strong>AutoType</strong><span>Recorder</span></div>
        <div className="session-title"><span className="status-dot" />{session.title}<span className="event-count">{session.events.length} events</span></div>
        <div className="top-actions">
          <button className="button secondary" onClick={openSession}><Upload size={15} /> Import</button>
          <button className="button primary" onClick={exportVideo} disabled={exportProgress !== null}>
            <Download size={15} />{exportProgress === null ? "Export video" : `${Math.round(exportProgress * 100)}%`}
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="file-sidebar">
          <div className="sidebar-heading"><span>Project</span><button className="icon-button" title="Open recording" onClick={openSession}><FolderOpen size={15} /></button></div>
          <div className="project-root"><ChevronDown size={14} /><span>{session.projectName}</span></div>
          <div className="file-list">
            {files.map((document) => (
              <button
                key={document.path}
                className={`file-row ${document.path === replay.activeFile ? "active" : ""}`}
                onClick={() => {
                  const event = [...session.events].reverse().find((candidate) => candidate.file === document.path);
                  if (event) setTime(event.time);
                }}
              >
                <FileCode2 size={15} /><span>{basename(document.path)}</span>{document.isDirty && <Circle size={6} fill="currentColor" />}
              </button>
            ))}
          </div>
          <div className="takes-section">
            <div className="sidebar-label">TAKE</div>
            <button className="take-row active"><span className="take-index">01</span><span><strong>{session.title}</strong><small>{formatTime(timeline.duration)} · {session.events.length} events</small></span></button>
          </div>
          <div className="capture-state"><span className="capture-icon"><Circle size={7} fill="currentColor" /></span><span><strong>Intent capture</strong><small>Pixel-free source</small></span></div>
        </aside>

        <section className="stage-area">
          <div className="stage-toolbar">
            <div className="mode-control">
              {CAMERA_MODES.map((mode) => <button key={mode.value} className={cameraMode === mode.value ? "active" : ""} onClick={() => setCameraMode(mode.value)}>{mode.value === "ai-director" && <Sparkles size={13} />}{mode.label}</button>)}
            </div>
            <div className="viewport-readout">{dimensions.width} × {dimensions.height}<span />{settings.fps} FPS</div>
          </div>
          <div className="stage-canvas">
            <CodePreview
              document={activeDocument}
              focusLine={camera.focusLine}
              focusColumn={camera.focusColumn}
              zoom={camera.zoom}
              theme={theme}
              aspect={aspect}
              onReady={() => undefined}
            />
          </div>
          <div className="stage-status"><span>{notice}</span><span>{camera.transition.replace("-", " ")} · {camera.zoom.toFixed(2)}×</span></div>
        </section>

        <aside className="inspector">
          <div className="inspector-title"><span>Director</span><Sparkles size={15} /></div>
          <section className="inspector-section">
            <label className="field-label">Social preset</label>
            <div className="preset-list">
              {PRESETS.map((item) => (
                <button key={item.value} className={preset === item.value ? "active" : ""} onClick={() => setPreset(item.value)}>
                  <span><strong>{item.label}</strong><small>{item.detail}</small></span><ChevronRight size={14} />
                </button>
              ))}
            </div>
          </section>
          <section className="inspector-section two-column">
            <label><span className="field-label">Theme</span><select value={theme} onChange={(event) => setTheme(event.target.value)}>{THEMES.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label><span className="field-label">Speed</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{[1, 2, 4, 8].map((value) => <option value={value} key={value}>{value}×</option>)}</select></label>
          </section>
          <section className="inspector-section">
            <div className="section-kicker">EXPORT</div>
            <label className="field-label">Canvas</label>
            <select value={settings.resolution} onChange={(event) => setSettings({ ...settings, resolution: event.target.value as ExportSettings["resolution"] })}>
              <option value="1080p">Landscape · 1920 × 1080</option>
              <option value="1440p">Landscape · 2560 × 1440</option>
              <option value="4k">4K · 3840 × 2160</option>
              <option value="vertical">Vertical · 1080 × 1920</option>
              <option value="square">Square · 1080 × 1080</option>
            </select>
            <div className="two-column export-fields">
              <label><span className="field-label">Format</span><select value={settings.format} onChange={(event) => setSettings({ ...settings, format: event.target.value as ExportSettings["format"] })}><option value="mp4">MP4</option><option value="mov">MOV</option><option value="webm">WebM</option></select></label>
              <label><span className="field-label">Frame rate</span><select value={settings.fps} onChange={(event) => setSettings({ ...settings, fps: Number(event.target.value) as 30 | 60 })}><option value={30}>30 FPS</option><option value={60}>60 FPS</option></select></label>
            </div>
          </section>
          <div className="director-summary"><div><span>Camera cuts</span><strong>{keyframes.length}</strong></div><div><span>Movement</span><strong>{preset === "youtube" ? "Low" : preset === "tiktok" ? "High" : "Medium"}</strong></div></div>
        </aside>
      </div>

      <footer className="timeline-panel">
        <div className="transport">
          <button className="icon-button" title="Rewind to start" onClick={() => { setPlaying(false); setTime(0); }}><RotateCcw size={16} /></button>
          <button className="play-button" title={playing ? "Pause" : "Play"} onClick={togglePlayback}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button>
          <span className="timecode">{formatTime(time)} <small>/ {formatTime(timeline.duration)}</small></span>
        </div>
        <div className="timeline-content">
          <div className="ruler">{Array.from({ length: 9 }, (_, index) => <span key={index} style={{ left: `${index * 12.5}%` }}>{formatTime((timeline.duration * index) / 8)}</span>)}</div>
          <div className="track camera-track"><label>CAMERA</label>{keyframes.map((frame, index) => <button title={`${frame.transition} at ${formatTime(frame.time)}`} key={`${frame.time}-${index}`} className="camera-cut" style={{ left: `${(frame.time / timeline.duration) * 100}%` }} onClick={() => setTime(frame.time)} />)}</div>
          <div className="track event-track"><label>INTENT</label>{session.events.map((event) => <button title={`${event.type} at ${formatTime(event.time)}`} key={event.id} className="event-marker" style={{ left: `${(event.time / timeline.duration) * 100}%`, background: EVENT_COLORS[event.type] ?? "#64717b" }} onClick={() => setTime(event.time)} />)}</div>
          <input aria-label="Timeline position" className="scrubber" type="range" min={0} max={timeline.duration} step={0.01} value={time} onChange={(event) => { setPlaying(false); setTime(Number(event.target.value)); }} />
          <div className="playhead" style={{ left: `${(time / timeline.duration) * 100}%` }}><span /></div>
        </div>
      </footer>
    </main>
  );
}
