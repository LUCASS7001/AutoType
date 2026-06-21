import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type {
  RecordingSession,
  SessionDocument,
  TimelineEvent,
} from "@autotype/core";
import { SESSION_VERSION } from "@autotype/core";
import * as vscode from "vscode";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
type EventWithoutMeta<T> = T extends unknown ? Omit<T, "id" | "time"> : never;

function selectionReason(reason: vscode.TextEditorSelectionChangeKind | undefined) {
  if (reason === vscode.TextEditorSelectionChangeKind.Keyboard) return "keyboard" as const;
  if (reason === vscode.TextEditorSelectionChangeKind.Mouse) return "mouse" as const;
  if (reason === vscode.TextEditorSelectionChangeKind.Command) return "command" as const;
  return undefined;
}

export class SessionRecorder implements vscode.Disposable {
  private startedAt = 0;
  private session: RecordingSession | undefined;
  private events: TimelineEvent[] = [];
  private subscriptions: vscode.Disposable[] = [];
  private outputDirectory: vscode.Uri | undefined;
  private journalPath: string | undefined;
  private sequence = 0;

  get isRecording(): boolean {
    return Boolean(this.session);
  }

  get currentSession(): RecordingSession | undefined {
    return this.session;
  }

  private relativePath(uri: vscode.Uri): string {
    if (uri.scheme === "untitled") return `untitled/${path.basename(uri.path) || "Untitled"}`;
    return vscode.workspace.asRelativePath(uri, false).replaceAll("\\", "/");
  }

  private now(): number {
    return Number(((performance.now() - this.startedAt) / 1000).toFixed(3));
  }

  private eventId(): string {
    this.sequence += 1;
    return `${this.session?.id ?? "session"}:${this.sequence}`;
  }

  private captureDocument(document: vscode.TextDocument): SessionDocument {
    return {
      path: this.relativePath(document.uri),
      language: document.languageId,
      content: document.getText(),
    };
  }

  private shouldCapture(document: vscode.TextDocument): boolean {
    if (["output", "vscode-userdata", "git"].includes(document.uri.scheme)) return false;
    if (document.uri.scheme === "untitled") {
      return vscode.workspace.getConfiguration("autotypeRecorder").get("captureUntitled", true);
    }
    return document.uri.scheme === "file";
  }

  async start(storageUri: vscode.Uri): Promise<RecordingSession> {
    if (this.session) return this.session;
    const workspace = vscode.workspace.workspaceFolders?.[0];
    const id = crypto.randomUUID();
    const openDocuments = vscode.workspace.textDocuments.filter((document) => this.shouldCapture(document));
    const redactPath = vscode.workspace.getConfiguration("autotypeRecorder").get("redactWorkspacePath", true);

    this.startedAt = performance.now();
    this.sequence = 0;
    this.events = [];
    this.session = {
      version: SESSION_VERSION,
      id,
      title: `${workspace?.name ?? "Untitled project"} recording`,
      projectName: workspace?.name ?? "Untitled project",
      workspacePath: redactPath ? undefined : workspace?.uri.fsPath,
      startedAt: new Date().toISOString(),
      duration: 0,
      initialDocuments: openDocuments.map((document) => this.captureDocument(document)),
      events: this.events,
    };

    this.outputDirectory = vscode.Uri.joinPath(storageUri, "recordings");
    await vscode.workspace.fs.createDirectory(this.outputDirectory);
    this.journalPath = path.join(this.outputDirectory.fsPath, `${id}.journal.ndjson`);
    await fs.writeFile(this.journalPath, `${JSON.stringify({ type: "session", session: this.session })}\n`, "utf8");
    this.subscribe();

    const active = vscode.window.activeTextEditor;
    if (active && this.shouldCapture(active.document)) this.captureActiveEditor(active);
    return this.session;
  }

  private record(event: EventWithoutMeta<TimelineEvent>): void {
    if (!this.session) return;
    const complete = { ...event, id: this.eventId(), time: this.now() } as TimelineEvent;
    this.events.push(complete);
    if (this.journalPath) {
      void fs.appendFile(this.journalPath, `${JSON.stringify(complete)}\n`, "utf8");
    }
  }

  private captureActiveEditor(editor: vscode.TextEditor): void {
    this.record({
      type: "active-editor",
      file: this.relativePath(editor.document.uri),
      language: editor.document.languageId,
      tabLabel: path.basename(editor.document.fileName || editor.document.uri.path),
    });
  }

  private subscribe(): void {
    this.subscriptions.push(
      vscode.workspace.onDidChangeTextDocument((change) => {
        if (!this.shouldCapture(change.document)) return;
        for (const contentChange of change.contentChanges) {
          const operation = contentChange.rangeLength > 0
            ? contentChange.text.length > 0 ? "replace" : "delete"
            : contentChange.text.length > 1 ? "paste" : "insert";
          this.record({
            type: "text-change",
            file: this.relativePath(change.document.uri),
            language: change.document.languageId,
            operation,
            rangeOffset: contentChange.rangeOffset,
            rangeLength: contentChange.rangeLength,
            text: contentChange.text,
            start: { line: contentChange.range.start.line, column: contentChange.range.start.character },
            end: { line: contentChange.range.end.line, column: contentChange.range.end.character },
          });
        }
      }),
      vscode.window.onDidChangeTextEditorSelection((change) => {
        if (!this.shouldCapture(change.textEditor.document)) return;
        this.record({
          type: "selection",
          file: this.relativePath(change.textEditor.document.uri),
          selections: change.selections.map((selection) => ({
            anchor: { line: selection.anchor.line, column: selection.anchor.character },
            active: { line: selection.active.line, column: selection.active.character },
          })),
          reason: selectionReason(change.kind),
        });
      }),
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && this.shouldCapture(editor.document)) this.captureActiveEditor(editor);
      }),
      vscode.window.onDidChangeVisibleTextEditors((editors) => {
        const editor = editors.find((candidate) => candidate === vscode.window.activeTextEditor);
        if (editor && this.shouldCapture(editor.document)) this.captureActiveEditor(editor);
      }),
      vscode.window.onDidChangeTextEditorVisibleRanges((change) => {
        if (!this.shouldCapture(change.textEditor.document) || change.visibleRanges.length === 0) return;
        this.record({
          type: "viewport",
          file: this.relativePath(change.textEditor.document.uri),
          topLine: change.visibleRanges[0]!.start.line,
          bottomLine: change.visibleRanges.at(-1)!.end.line,
        });
      }),
      vscode.workspace.onDidSaveTextDocument((document) => {
        if (this.shouldCapture(document)) this.record({ type: "document-save", file: this.relativePath(document.uri), language: document.languageId });
      }),
      vscode.workspace.onDidOpenTextDocument((document) => {
        if (this.shouldCapture(document)) this.record({ type: "document-open", file: this.relativePath(document.uri), language: document.languageId, content: document.getText() });
      }),
      vscode.workspace.onDidCloseTextDocument((document) => {
        if (this.shouldCapture(document)) this.record({ type: "document-close", file: this.relativePath(document.uri), language: document.languageId });
      }),
      vscode.workspace.onDidCreateFiles((change) => {
        for (const uri of change.files) {
          void vscode.workspace.fs.readFile(uri).then((bytes) => {
            this.record({ type: "file-create", file: this.relativePath(uri), language: "plaintext", content: textDecoder.decode(bytes) });
          }, () => this.record({ type: "file-create", file: this.relativePath(uri), language: "plaintext", content: "" }));
        }
      }),
      vscode.workspace.onDidRenameFiles((change) => {
        for (const file of change.files) this.record({ type: "file-rename", oldFile: this.relativePath(file.oldUri), file: this.relativePath(file.newUri) });
      }),
      vscode.workspace.onDidDeleteFiles((change) => {
        for (const uri of change.files) this.record({ type: "file-delete", file: this.relativePath(uri) });
      }),
    );
  }

  async stop(): Promise<{ session: RecordingSession; uri: vscode.Uri } | undefined> {
    if (!this.session || !this.outputDirectory) return undefined;
    this.subscriptions.splice(0).forEach((subscription) => subscription.dispose());
    const session = {
      ...this.session,
      endedAt: new Date().toISOString(),
      duration: this.now(),
      events: [...this.events],
    };
    const uri = vscode.Uri.joinPath(this.outputDirectory, `${session.id}.autotype.json`);
    await vscode.workspace.fs.writeFile(uri, textEncoder.encode(JSON.stringify(session, null, 2)));
    this.session = undefined;
    this.events = [];
    return { session, uri };
  }

  dispose(): void {
    this.subscriptions.splice(0).forEach((subscription) => subscription.dispose());
    this.session = undefined;
  }
}
