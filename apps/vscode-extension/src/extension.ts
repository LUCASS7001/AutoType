import * as path from "node:path";
import * as vscode from "vscode";
import { SessionRecorder } from "./recorder";

let recorder: SessionRecorder;
let status: vscode.StatusBarItem;
let lastRecording: vscode.Uri | undefined;

function updateStatus(): void {
  const recording = recorder.isRecording;
  void vscode.commands.executeCommand("setContext", "autotypeRecorder.isRecording", recording);
  status.text = recording ? "$(record) AutoType  REC" : "$(circle-outline) AutoType Recorder";
  status.tooltip = recording ? "Click to stop and save this recording" : "Click to start recording editor intent";
  status.command = recording ? "autotypeRecorder.stop" : "autotypeRecorder.start";
  status.backgroundColor = recording ? new vscode.ThemeColor("statusBarItem.errorBackground") : undefined;
}

export function activate(context: vscode.ExtensionContext): void {
  recorder = new SessionRecorder();
  status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  status.name = "AutoType Recorder";
  status.show();
  updateStatus();

  context.subscriptions.push(
    recorder,
    status,
    vscode.commands.registerCommand("autotypeRecorder.start", async () => {
      if (!context.storageUri) {
        vscode.window.showErrorMessage("AutoType Recorder could not access workspace storage.");
        return;
      }
      const session = await recorder.start(context.storageUri);
      updateStatus();
      vscode.window.showInformationMessage(`Recording “${session.projectName}”. Press Ctrl+Alt+R to finish.`);
    }),
    vscode.commands.registerCommand("autotypeRecorder.stop", async () => {
      const result = await recorder.stop();
      updateStatus();
      if (!result) return;
      lastRecording = result.uri;
      const action = await vscode.window.showInformationMessage(
        `Captured ${result.session.events.length} events over ${result.session.duration.toFixed(1)}s.`,
        "Export session",
      );
      if (action === "Export session") await vscode.commands.executeCommand("autotypeRecorder.export");
    }),
    vscode.commands.registerCommand("autotypeRecorder.export", async () => {
      if (!lastRecording) {
        vscode.window.showWarningMessage("Record a session before exporting it.");
        return;
      }
      const destination = await vscode.window.showSaveDialog({
        defaultUri: vscode.Uri.file(path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? lastRecording.fsPath, "recording.autotype.json")),
        filters: { "AutoType Session": ["json"] },
        saveLabel: "Export recording",
      });
      if (destination) {
        await vscode.workspace.fs.copy(lastRecording, destination, { overwrite: true });
        vscode.window.showInformationMessage(`AutoType session exported to ${destination.fsPath}.`);
      }
    }),
  );
}

export function deactivate(): void {
  recorder?.dispose();
}
