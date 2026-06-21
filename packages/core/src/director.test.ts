import { describe, expect, it } from "vitest";
import { directSession, sampleCamera } from "./director";
import type { RecordingSession } from "./types";

const session: RecordingSession = {
  version: 1,
  id: "director",
  title: "Director",
  projectName: "project",
  startedAt: "2026-01-01T00:00:00.000Z",
  duration: 5,
  initialDocuments: [{ path: "app.ts", language: "typescript", content: "" }],
  events: [
    { id: "1", time: 1, type: "text-change", file: "app.ts", language: "typescript", operation: "insert", rangeOffset: 0, rangeLength: 0, text: "x", start: { line: 2, column: 3 }, end: { line: 2, column: 3 } },
    { id: "2", time: 3, type: "file-create", file: "new.ts", language: "typescript", content: "" },
  ],
};

describe("cinematic director", () => {
  it("creates semantic transitions and interpolates camera motion", () => {
    const frames = directSession(session, "ai-director", "lovable");
    expect(frames.some((frame) => frame.transition === "file-switch")).toBe(true);
    const camera = sampleCamera(frames, 2);
    expect(camera.zoom).toBeGreaterThan(0.9);
    expect(camera.progress).toBeGreaterThanOrEqual(0);
  });
});
