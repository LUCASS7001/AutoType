import { describe, expect, it } from "vitest";
import { TimelineEngine } from "./timeline";
import type { RecordingSession } from "./types";

const session: RecordingSession = {
  version: 1,
  id: "test",
  title: "Test",
  projectName: "demo",
  startedAt: "2026-01-01T00:00:00.000Z",
  duration: 3,
  initialDocuments: [{ path: "src/app.ts", language: "typescript", content: "const x = 1;" }],
  events: [
    {
      id: "1",
      time: 1,
      type: "text-change",
      file: "src/app.ts",
      language: "typescript",
      operation: "replace",
      rangeOffset: 10,
      rangeLength: 1,
      text: "2",
      start: { line: 0, column: 10 },
      end: { line: 0, column: 11 },
    },
    {
      id: "2",
      time: 2,
      type: "file-rename",
      oldFile: "src/app.ts",
      file: "src/main.ts",
    },
  ],
};

describe("TimelineEngine", () => {
  it("reconstructs deterministic state when seeking backward and forward", () => {
    const timeline = new TimelineEngine(session, 0.5);
    expect(timeline.getStateAt(1.5).documents.get("src/app.ts")?.content).toBe("const x = 2;");
    expect(timeline.getStateAt(0.5).documents.get("src/app.ts")?.content).toBe("const x = 1;");
    expect(timeline.getStateAt(3).documents.get("src/main.ts")?.content).toBe("const x = 2;");
  });
});
