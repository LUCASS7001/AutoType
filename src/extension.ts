import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let isTyping = false;
let cancelRequested = false;
let statusBarItem: vscode.StatusBarItem;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getBaseSpeed(): number {
  const config = vscode.workspace.getConfiguration('autotype');
  return config.get<number>('speed', 80);
}

function getTypoChance(): number {
  const config = vscode.workspace.getConfiguration('autotype');
  return config.get<number>('typoChance', 0.03);
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setTypingContext(value: boolean): void {
  isTyping = value;
  vscode.commands.executeCommand('setContext', 'autotype.isTyping', value);
  updateStatusBar();
}

function updateStatusBar(): void {
  if (!statusBarItem) {
    return;
  }
  if (isTyping) {
    statusBarItem.text = '$(loading~spin) AutoType: Typing... (press Esc to stop)';
    statusBarItem.tooltip = 'AutoType is typing – press Escape to stop';
  } else {
    statusBarItem.text = '$(keyboard) AutoType: Ready';
    statusBarItem.tooltip = 'Click to open AutoType commands';
  }
}

async function runCountdown(editor: vscode.TextEditor): Promise<void> {
  const steps = ['3... ', '2... ', '1... '];
  for (let i = 0; i < steps.length; i++) {
    if (cancelRequested) return;
    const step = steps[i];
    
    await editor.edit(editBuilder => {
      editBuilder.insert(editor.selection.active, step);
    }, { undoStopBefore: false, undoStopAfter: false });
    
    await sleep(800);
    if (cancelRequested) return;
    
    await editor.edit(editBuilder => {
      const position = editor.selection.active;
      const start = position.translate(0, -step.length);
      editBuilder.delete(new vscode.Range(start, position));
    }, { undoStopBefore: false, undoStopAfter: false });
  }
  
  // 2-Second Pause before typing begins so user can hit record
  if (!cancelRequested) {
    await sleep(2000);
  }
}

// ---------------------------------------------------------------------------
// Typing engine
// ---------------------------------------------------------------------------

async function typeText(text: string): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('AutoType: No active text editor. Open a file first.');
    return;
  }

  if (isTyping) {
    vscode.window.showWarningMessage('AutoType: Already typing. Stop the current session first.');
    return;
  }

  if (!text || text.length === 0) {
    vscode.window.showWarningMessage('AutoType: Nothing to type – the text is empty.');
    return;
  }

  cancelRequested = false;
  setTypingContext(true);

  // Run the 3-2-1 countdown inline (including 2s wait)
  await runCountdown(editor);

  if (cancelRequested) {
    setTypingContext(false);
    return;
  }

  const baseSpeed = getBaseSpeed();
  const typoChance = getTypoChance();
  let charsSinceThinkingPause = 0;
  let nextThinkingPauseAt = randomBetween(5, 15);

  // Normalize Windows \r\n to Linux \n so we don't double-type enters leading to large spacing bugs.
  const normalizedText = text.replace(/\r\n/g, '\n');

  try {
    for (let i = 0; i < normalizedText.length; i++) {
      if (cancelRequested) {
        vscode.window.showInformationMessage('AutoType: Stopped.');
        break;
      }

      const char = normalizedText[i];
      let position = editor.selection.active;

      // Handle auto-closing tags and indentation
      const lineText = editor.document.lineAt(position.line).text;
      const charAhead = lineText.substring(position.character, position.character + 1);
      
      // If the character ahead of the cursor is exactly the character we want to type,
      // it means VS Code automatically inserted it (like </tags>, closing brackets, or indent spaces).
      // We skip typing it and just move the cursor forward to prevent duplicates.
      if (charAhead === char) {
        // Just move the cursor forward
        const newPosition = position.translate(0, 1);
        editor.selection = new vscode.Selection(newPosition, newPosition);
      } else {
        // Typo simulation
        if (Math.random() < typoChance && /[a-zA-Z]/.test(char) && i > 0) {
          const wrongChar = String.fromCharCode(char.charCodeAt(0) + randomBetween(-1, 2));
          
          await editor.edit(editBuilder => {
            editBuilder.insert(editor.selection.active, wrongChar);
          }, { undoStopBefore: false, undoStopAfter: false });
          
          await sleep(baseSpeed + randomBetween(50, 150));
          await vscode.commands.executeCommand('deleteLeft');
          await sleep(baseSpeed + randomBetween(50, 100));
        }

        // Insert the actual character
        await editor.edit(editBuilder => {
          editBuilder.insert(editor.selection.active, char);
        }, { undoStopBefore: i === 0, undoStopAfter: i === normalizedText.length - 1 });
      }

      // Base delay ± 30% random variation
      const variation = baseSpeed * 0.3;
      let delay = baseSpeed + randomBetween(-variation, variation);

      // Newline extra pause
      if (char === '\n') {
        delay += randomBetween(300, 800);
      }

      // Thinking pause
      charsSinceThinkingPause++;
      if (charsSinceThinkingPause >= nextThinkingPauseAt) {
        delay += randomBetween(200, 600);
        charsSinceThinkingPause = 0;
        nextThinkingPauseAt = randomBetween(5, 15);
      }

      await sleep(delay);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`AutoType: Error while typing – ${message}`);
  } finally {
    setTypingContext(false);
  }
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function fromClipboard(): Promise<void> {
  try {
    const text = await vscode.env.clipboard.readText();
    if (!text) {
      vscode.window.showWarningMessage('AutoType: Clipboard is empty.');
      return;
    }
    await typeText(text);
  } catch {
    vscode.window.showErrorMessage('AutoType: Failed to read clipboard.');
  }
}

async function fromFile(): Promise<void> {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    openLabel: 'Select file to type',
    filters: {
      'Code Files': ['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'py'],
    },
  });

  if (!uris || uris.length === 0) {
    return; // user cancelled
  }

  const filePath = uris[0].fsPath;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    if (!content) {
      vscode.window.showWarningMessage(`AutoType: File is empty – ${path.basename(filePath)}`);
      return;
    }
    await typeText(content);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`AutoType: Failed to read file – ${message}`);
  }
}

async function setSpeed(): Promise<void> {
  const pick = await vscode.window.showQuickPick(
    [
      { label: '🐢  Slow', description: '150 ms per character', value: 150 },
      { label: '🏃  Medium', description: '80 ms per character', value: 80 },
      { label: '⚡  Fast', description: '30 ms per character', value: 30 },
      { label: '✏️  Custom', description: 'Enter your own value', value: -1 },
    ],
    { placeHolder: 'Select typing speed' },
  );

  if (!pick) {
    return;
  }

  let speed = pick.value;

  if (speed === -1) {
    const input = await vscode.window.showInputBox({
      prompt: 'Enter milliseconds per character',
      value: String(getBaseSpeed()),
      validateInput: (v) => {
        const n = Number(v);
        if (isNaN(n) || n < 1 || !Number.isInteger(n)) {
          return 'Please enter a positive whole number';
        }
        return undefined;
      },
    });
    if (!input) {
      return;
    }
    speed = Number(input);
  }

  const config = vscode.workspace.getConfiguration('autotype');
  await config.update('speed', speed, vscode.ConfigurationTarget.Workspace);
  vscode.window.showInformationMessage(`AutoType: Speed set to ${speed} ms per character.`);
}

async function retypeSelection(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('AutoType: No active text editor.');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showWarningMessage('AutoType: No text selected to retype.');
    return;
  }

  const text = editor.document.getText(selection);
  
  // Delete the selected text first
  await editor.edit(editBuilder => {
    editBuilder.delete(selection);
  });

  // Type it back
  await typeText(text);
}

async function typeContextFile(uri: vscode.Uri): Promise<void> {
  if (!uri || !uri.fsPath) {
    vscode.window.showErrorMessage('AutoType: No file selected.');
    return;
  }

  try {
    const content = fs.readFileSync(uri.fsPath, 'utf-8');
    if (!content) {
      vscode.window.showWarningMessage(`AutoType: File is empty – ${path.basename(uri.fsPath)}`);
      return;
    }

    // Since this is triggered from explorer, we need an active text editor
    // If there isn't one, we should create a new untitled file
    let editor = vscode.window.activeTextEditor;
    if (!editor) {
      const document = await vscode.workspace.openTextDocument({ language: 'plaintext' });
      editor = await vscode.window.showTextDocument(document);
    }

    await typeText(content);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    vscode.window.showErrorMessage(`AutoType: Failed to read file – ${message}`);
  }
}

function stop(): void {
  if (isTyping) {
    cancelRequested = true;
  }
}

// ---------------------------------------------------------------------------
// Activation / Deactivation
// ---------------------------------------------------------------------------

export function activate(context: vscode.ExtensionContext): void {
  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
  statusBarItem.command = 'workbench.action.quickOpen';
  statusBarItem.text = '$(keyboard) AutoType: Ready';
  statusBarItem.tooltip = 'Click to open AutoType commands';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Override statusbar click to filter commands
  statusBarItem.command = {
    title: 'AutoType Commands',
    command: 'workbench.action.quickOpen',
    arguments: ['>AutoType'],
  } as unknown as string;

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('autotype.fromClipboard', fromClipboard),
    vscode.commands.registerCommand('autotype.fromFile', fromFile),
    vscode.commands.registerCommand('autotype.setSpeed', setSpeed),
    vscode.commands.registerCommand('autotype.retypeSelection', retypeSelection),
    vscode.commands.registerCommand('autotype.typeContextFile', typeContextFile),
    vscode.commands.registerCommand('autotype.stop', stop),
  );
}

export function deactivate(): void {
  cancelRequested = true;
}
