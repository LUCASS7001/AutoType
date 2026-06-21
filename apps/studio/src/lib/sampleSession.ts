import type { RecordingSession, TimelineEvent } from "@autotype/core";

const id = (index: number) => `demo:${index}`;

const events: TimelineEvent[] = [
  { id: id(1), time: 0.4, type: "active-editor", file: "src/server.ts", language: "typescript", tabLabel: "server.ts" },
  { id: id(2), time: 1.2, type: "selection", file: "src/server.ts", selections: [{ anchor: { line: 3, column: 0 }, active: { line: 3, column: 0 } }], reason: "keyboard" },
  { id: id(3), time: 2.1, type: "text-change", file: "src/server.ts", language: "typescript", operation: "paste", rangeOffset: 61, rangeLength: 0, text: "const app = express();\n\n", start: { line: 3, column: 0 }, end: { line: 3, column: 0 } },
  { id: id(4), time: 4.2, type: "text-change", file: "src/server.ts", language: "typescript", operation: "paste", rangeOffset: 85, rangeLength: 0, text: "app.get(\"/health\", (_request, response) => {\n  response.json({ status: \"ready\" });\n});\n\n", start: { line: 5, column: 0 }, end: { line: 5, column: 0 } },
  { id: id(5), time: 6.1, type: "selection", file: "src/server.ts", selections: [{ anchor: { line: 6, column: 27 }, active: { line: 6, column: 32 } }], reason: "mouse" },
  { id: id(6), time: 7.5, type: "text-change", file: "src/server.ts", language: "typescript", operation: "replace", rangeOffset: 157, rangeLength: 5, text: "online", start: { line: 6, column: 27 }, end: { line: 6, column: 32 } },
  { id: id(7), time: 9, type: "viewport", file: "src/server.ts", topLine: 2, bottomLine: 14 },
  { id: id(8), time: 10.3, type: "text-change", file: "src/server.ts", language: "typescript", operation: "paste", rangeOffset: 173, rangeLength: 0, text: "app.listen(3000, () => {\n  console.log(\"Studio API listening on :3000\");\n});\n", start: { line: 9, column: 0 }, end: { line: 9, column: 0 } },
  { id: id(9), time: 13, type: "file-create", file: "src/config.ts", language: "typescript", content: "" },
  { id: id(10), time: 13.2, type: "active-editor", file: "src/config.ts", language: "typescript", tabLabel: "config.ts" },
  { id: id(11), time: 14.4, type: "text-change", file: "src/config.ts", language: "typescript", operation: "paste", rangeOffset: 0, rangeLength: 0, text: "export const config = {\n  port: 3000,\n  environment: \"development\",\n} as const;\n", start: { line: 0, column: 0 }, end: { line: 0, column: 0 } },
  { id: id(12), time: 16.8, type: "selection", file: "src/config.ts", selections: [{ anchor: { line: 2, column: 16 }, active: { line: 2, column: 27 } }], reason: "keyboard" },
  { id: id(13), time: 18, type: "text-change", file: "src/config.ts", language: "typescript", operation: "replace", rangeOffset: 54, rangeLength: 11, text: "production", start: { line: 2, column: 16 }, end: { line: 2, column: 27 } },
  { id: id(14), time: 20.2, type: "document-save", file: "src/config.ts", language: "typescript" },
];

export const sampleSession: RecordingSession = {
  version: 1,
  id: "autotype-demo",
  title: "Studio API launch",
  projectName: "launch-studio",
  startedAt: "2026-06-20T12:00:00.000Z",
  endedAt: "2026-06-20T12:00:22.000Z",
  duration: 22,
  initialDocuments: [
    {
      path: "src/server.ts",
      language: "typescript",
      content: "import express from \"express\";\nimport helmet from \"helmet\";\n\n",
    },
  ],
  events,
};
