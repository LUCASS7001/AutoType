import * as monaco from "monaco-editor";
import { useMemo } from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  directSession,
  sampleCamera,
  TimelineEngine,
  type CameraMode,
  type DirectorPreset,
  type ExportSettings,
  type RecordingSession,
} from "@autotype/core";

export interface RecordingVideoProps extends Record<string, unknown> {
  session: RecordingSession;
  cameraMode: CameraMode;
  preset: DirectorPreset;
  theme: string;
  settings: ExportSettings;
}

interface Palette {
  canvas: string;
  editor: string;
  chrome: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  keyword: string;
  string: string;
  number: string;
  comment: string;
}

const PALETTES: Record<string, Palette> = {
  "VS Code Dark+": { canvas: "#0d0f11", editor: "#151719", chrome: "#202427", border: "#30363a", text: "#d4d4d4", muted: "#6f7780", accent: "#59c2ff", keyword: "#c586c0", string: "#ce9178", number: "#b5cea8", comment: "#6a9955" },
  "GitHub Dark": { canvas: "#080b0f", editor: "#0d1117", chrome: "#161b22", border: "#30363d", text: "#c9d1d9", muted: "#6e7681", accent: "#58a6ff", keyword: "#ff7b72", string: "#a5d6ff", number: "#79c0ff", comment: "#8b949e" },
  "GitHub Light": { canvas: "#e9edf1", editor: "#ffffff", chrome: "#f6f8fa", border: "#d0d7de", text: "#24292f", muted: "#8c959f", accent: "#0969da", keyword: "#cf222e", string: "#0a3069", number: "#0550ae", comment: "#6e7781" },
  "One Dark Pro": { canvas: "#101216", editor: "#17191e", chrome: "#21252b", border: "#333842", text: "#abb2bf", muted: "#5c6370", accent: "#61afef", keyword: "#c678dd", string: "#98c379", number: "#d19a66", comment: "#5c6370" },
  "Tokyo Night": { canvas: "#0e0e15", editor: "#16161e", chrome: "#1f2335", border: "#2b3048", text: "#c0caf5", muted: "#565f89", accent: "#7aa2f7", keyword: "#bb9af7", string: "#9ece6a", number: "#ff9e64", comment: "#565f89" },
  Dracula: { canvas: "#111219", editor: "#191a21", chrome: "#282a36", border: "#3a3c4d", text: "#f8f8f2", muted: "#6272a4", accent: "#8be9fd", keyword: "#ff79c6", string: "#f1fa8c", number: "#bd93f9", comment: "#6272a4" },
};

function tokenColor(type: string, palette: Palette): string {
  if (/comment/.test(type)) return palette.comment;
  if (/string|regexp/.test(type)) return palette.string;
  if (/number/.test(type)) return palette.number;
  if (/keyword|tag|type|constructor/.test(type)) return palette.keyword;
  if (/delimiter|operator/.test(type)) return palette.muted;
  return palette.text;
}

function TokenizedCode({ code, language, palette, fontSize, lineHeight }: { code: string; language: string; palette: Palette; fontSize: number; lineHeight: number }) {
  const tokenLines = useMemo(() => {
    try {
      return monaco.editor.tokenize(code, language || "plaintext");
    } catch {
      return code.split("\n").map(() => []);
    }
  }, [code, language]);
  const rawLines = code.split("\n");

  return (
    <div style={{ fontFamily: "'Cascadia Code', 'JetBrains Mono', Consolas, monospace", fontSize, lineHeight: `${lineHeight}px`, color: palette.text }}>
      {rawLines.map((line, lineIndex) => {
        const tokens = tokenLines[lineIndex] ?? [];
        return (
          <div key={lineIndex} style={{ display: "grid", gridTemplateColumns: `${fontSize * 3.2}px 1fr`, minHeight: lineHeight }}>
            <span style={{ color: palette.muted, opacity: 0.55, textAlign: "right", paddingRight: fontSize * 1.1, userSelect: "none" }}>{lineIndex + 1}</span>
            <span style={{ whiteSpace: "pre" }}>
              {tokens.length === 0 ? line || " " : tokens.map((token, tokenIndex) => {
                const end = tokens[tokenIndex + 1]?.offset ?? line.length;
                return <span key={`${token.offset}-${tokenIndex}`} style={{ color: tokenColor(token.type, palette) }}>{line.slice(token.offset, end)}</span>;
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RecordingVideo({ session, cameraMode, preset, theme }: RecordingVideoProps) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const time = frame / fps;
  const timeline = useMemo(() => new TimelineEngine(session), [session]);
  const keyframes = useMemo(() => directSession(session, cameraMode, preset), [cameraMode, preset, session]);
  const state = timeline.getStateAt(time);
  const camera = sampleCamera(keyframes, time);
  const document = state.activeFile ? state.documents.get(state.activeFile) : undefined;
  const palette = PALETTES[theme] ?? PALETTES["GitHub Dark"]!;
  const portrait = height > width;
  const square = height === width;
  const margin = Math.round(Math.min(width, height) * (portrait ? 0.055 : 0.07));
  const chromeHeight = Math.round(Math.max(48, height * 0.05));
  const fontSize = Math.round(Math.max(22, Math.min(42, width / (portrait ? 34 : 62))));
  const lineHeight = Math.round(fontSize * 1.58);
  const editorHeight = height - margin * 2 - chromeHeight;
  const focusY = camera.focusLine * lineHeight;
  const targetY = editorHeight * (portrait ? 0.42 : 0.5) - focusY;
  const translateY = Math.min(0, targetY);
  const currentKeyframe = [...keyframes].reverse().find((item) => item.time <= time);
  const transitionAge = currentKeyframe ? time - currentKeyframe.time : 1;
  const opacity = currentKeyframe?.transition === "file-switch"
    ? interpolate(transitionAge, [0, 0.18, 0.45], [0.1, 0.75, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
    : 1;
  const entrance = interpolate(frame, [0, fps * 0.6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ background: palette.canvas, color: palette.text, fontFamily: "Inter, system-ui, sans-serif", overflow: "hidden" }}>
      <div style={{ position: "absolute", inset: 0, opacity: 0.15, backgroundImage: `linear-gradient(${palette.border} 1px, transparent 1px), linear-gradient(90deg, ${palette.border} 1px, transparent 1px)`, backgroundSize: `${Math.round(width / 48)}px ${Math.round(width / 48)}px` }} />
      <div style={{ position: "absolute", inset: margin, overflow: "hidden", border: `1px solid ${palette.border}`, borderRadius: Math.round(width * 0.006), background: palette.editor, boxShadow: `0 ${height * 0.03}px ${height * 0.09}px #00000080`, opacity: entrance, transform: `translateY(${(1 - entrance) * height * 0.025}px)` }}>
        <div style={{ height: chromeHeight, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: `0 ${Math.round(chromeHeight * 0.42)}px`, borderBottom: `1px solid ${palette.border}`, background: palette.chrome }}>
          <div style={{ display: "flex", gap: chromeHeight * 0.17 }}><i style={{ width: chromeHeight * 0.2, height: chromeHeight * 0.2, borderRadius: "50%", background: "#f06d63" }} /><i style={{ width: chromeHeight * 0.2, height: chromeHeight * 0.2, borderRadius: "50%", background: "#e3bd55" }} /><i style={{ width: chromeHeight * 0.2, height: chromeHeight * 0.2, borderRadius: "50%", background: "#59c988" }} /></div>
          <div style={{ color: palette.muted, fontSize: Math.round(fontSize * 0.55), fontWeight: 650 }}>{document?.path.split("/").at(-1) ?? "Untitled"}</div>
          <div style={{ justifySelf: "end", color: palette.accent, fontSize: Math.round(fontSize * 0.42), fontWeight: 800, letterSpacing: "0.08em" }}>AUTOTYPE RECORDER</div>
        </div>
        <div style={{ position: "absolute", inset: `${chromeHeight}px 0 0`, overflow: "hidden", opacity }}>
          <div style={{ position: "absolute", left: portrait ? fontSize : fontSize * 1.4, right: 0, top: 0, paddingTop: lineHeight, transformOrigin: `${portrait ? "48%" : "42%"} ${editorHeight / 2}px`, transform: `translate3d(0, ${translateY}px, 0) scale(${camera.zoom})` }}>
            <TokenizedCode code={document?.content ?? ""} language={document?.language ?? "plaintext"} palette={palette} fontSize={fontSize} lineHeight={lineHeight} />
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, top: editorHeight * 0.5, height: lineHeight, transform: "translateY(-50%)", background: `${palette.accent}0b`, borderTop: `1px solid ${palette.accent}18`, borderBottom: `1px solid ${palette.accent}12`, pointerEvents: "none" }} />
        </div>
      </div>
      <div style={{ position: "absolute", right: margin, bottom: margin * 0.38, display: "flex", gap: 8, alignItems: "center", color: palette.muted, fontSize: Math.round(fontSize * 0.44), fontWeight: 700 }}>
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: palette.accent }} />
        {square || portrait ? session.projectName : `${session.projectName} · ${preset.toUpperCase()} DIRECTOR`}
      </div>
    </AbsoluteFill>
  );
}
