import type {
  RecordingSession,
  ReplayDocument,
  ReplayState,
  Selection,
  TimelineEvent,
} from "./types";

interface Checkpoint {
  time: number;
  eventIndex: number;
  state: ReplayState;
}

const cloneSelection = (selection: Selection): Selection => ({
  anchor: { ...selection.anchor },
  active: { ...selection.active },
});

function cloneState(state: ReplayState): ReplayState {
  return {
    time: state.time,
    activeFile: state.activeFile,
    documents: new Map(
      [...state.documents].map(([key, value]) => [key, { ...value }]),
    ),
    selections: new Map(
      [...state.selections].map(([key, value]) => [
        key,
        value.map(cloneSelection),
      ]),
    ),
    viewports: new Map(
      [...state.viewports].map(([key, value]) => [key, { ...value }]),
    ),
  };
}

function initialState(session: RecordingSession): ReplayState {
  return {
    time: 0,
    activeFile: session.initialDocuments[0]?.path,
    documents: new Map(
      session.initialDocuments.map((document) => [
        document.path,
        {
          ...document,
          exists: true,
          isOpen: false,
          isDirty: false,
        } satisfies ReplayDocument,
      ]),
    ),
    selections: new Map(),
    viewports: new Map(),
  };
}

function applyEvent(state: ReplayState, event: TimelineEvent): void {
  state.time = event.time;

  switch (event.type) {
    case "text-change": {
      const document = state.documents.get(event.file) ?? {
        path: event.file,
        language: event.language,
        content: "",
        exists: true,
        isOpen: true,
        isDirty: false,
      };
      const before = document.content.slice(0, event.rangeOffset);
      const after = document.content.slice(event.rangeOffset + event.rangeLength);
      state.documents.set(event.file, {
        ...document,
        content: before + event.text + after,
        language: event.language,
        exists: true,
        isDirty: true,
      });
      state.activeFile = event.file;
      break;
    }
    case "selection":
      state.selections.set(event.file, event.selections.map(cloneSelection));
      state.activeFile = event.file;
      break;
    case "active-editor":
      state.activeFile = event.file;
      break;
    case "viewport":
      state.viewports.set(event.file, {
        topLine: event.topLine,
        bottomLine: event.bottomLine,
      });
      break;
    case "document-open": {
      const document = state.documents.get(event.file);
      state.documents.set(event.file, document
        ? { ...document, isOpen: true }
        : {
            path: event.file,
            language: event.language,
            content: event.content ?? "",
            exists: true,
            isOpen: true,
            isDirty: false,
          });
      break;
    }
    case "document-close": {
      const document = state.documents.get(event.file);
      if (document) state.documents.set(event.file, { ...document, isOpen: false });
      break;
    }
    case "document-save": {
      const document = state.documents.get(event.file);
      if (document) state.documents.set(event.file, { ...document, isDirty: false });
      break;
    }
    case "file-create":
      state.documents.set(event.file, {
        path: event.file,
        language: event.language,
        content: event.content,
        exists: true,
        isOpen: true,
        isDirty: false,
      });
      state.activeFile = event.file;
      break;
    case "file-rename": {
      const document = state.documents.get(event.oldFile);
      if (document) {
        state.documents.delete(event.oldFile);
        state.documents.set(event.file, { ...document, path: event.file });
      }
      if (state.activeFile === event.oldFile) state.activeFile = event.file;
      break;
    }
    case "file-delete": {
      const document = state.documents.get(event.file);
      if (document) state.documents.set(event.file, { ...document, exists: false });
      if (state.activeFile === event.file) state.activeFile = undefined;
      break;
    }
  }
}

export class TimelineEngine {
  private readonly events: TimelineEvent[];
  private readonly checkpoints: Checkpoint[] = [];

  constructor(
    private readonly session: RecordingSession,
    checkpointInterval = 5,
  ) {
    this.events = [...session.events].sort((a, b) => a.time - b.time);
    const state = initialState(session);
    this.checkpoints.push({ time: 0, eventIndex: 0, state: cloneState(state) });

    let nextCheckpoint = checkpointInterval;
    this.events.forEach((event, index) => {
      applyEvent(state, event);
      if (event.time >= nextCheckpoint) {
        this.checkpoints.push({
          time: event.time,
          eventIndex: index + 1,
          state: cloneState(state),
        });
        nextCheckpoint = event.time + checkpointInterval;
      }
    });
  }

  get duration(): number {
    return Math.max(this.session.duration, this.events.at(-1)?.time ?? 0);
  }

  getStateAt(time: number): ReplayState {
    const target = Math.max(0, Math.min(time, this.duration));
    let checkpoint = this.checkpoints[0]!;
    for (const candidate of this.checkpoints) {
      if (candidate.time > target) break;
      checkpoint = candidate;
    }

    const state = cloneState(checkpoint.state);
    for (let index = checkpoint.eventIndex; index < this.events.length; index++) {
      const event = this.events[index]!;
      if (event.time > target) break;
      applyEvent(state, event);
    }
    state.time = target;
    return state;
  }

  getEventsBetween(start: number, end: number): TimelineEvent[] {
    return this.events.filter((event) => event.time >= start && event.time <= end);
  }
}
