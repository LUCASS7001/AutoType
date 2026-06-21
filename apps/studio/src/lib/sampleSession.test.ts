import { describe, expect, it } from "vitest";
import { TimelineEngine } from "@autotype/core";
import { sampleSession } from "./sampleSession";

describe("sample recording", () => {
  it("reconstructs valid final source without offset drift", () => {
    const state = new TimelineEngine(sampleSession).getStateAt(sampleSession.duration);
    expect(state.documents.get("src/server.ts")?.content).toContain('status: "online"');
    expect(state.documents.get("src/server.ts")?.content).toContain("app.listen(3000");
    expect(state.documents.get("src/config.ts")?.content).toContain('environment: "production"');
  });
});
