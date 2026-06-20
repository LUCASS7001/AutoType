"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let isTyping = false;
let cancelRequested = false;
let statusBarItem;
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getBaseSpeed() {
    const config = vscode.workspace.getConfiguration("autotype");
    return config.get("speed", 80);
}
function getTypoChance() {
    const config = vscode.workspace.getConfiguration("autotype");
    return config.get("typoChance", 0.03);
}
function getAutoScroll() {
    const config = vscode.workspace.getConfiguration("autotype");
    return config.get("autoScroll", true);
}
function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function setTypingContext(value) {
    isTyping = value;
    vscode.commands.executeCommand("setContext", "autotype.isTyping", value);
    updateStatusBar();
}
function updateStatusBar() {
    if (!statusBarItem) {
        return;
    }
    if (isTyping) {
        statusBarItem.text =
            "$(loading~spin) AutoType: Typing... (press Esc to stop)";
        statusBarItem.tooltip = "AutoType is typing – press Escape to stop";
    }
    else {
        statusBarItem.text = "$(keyboard) AutoType: Ready";
        statusBarItem.tooltip = "Click to open AutoType commands";
    }
}
async function runCountdown(editor) {
    const steps = ["3... ", "2... ", "1... "];
    for (let i = 0; i < steps.length; i++) {
        if (cancelRequested)
            return;
        const step = steps[i];
        await editor.edit((editBuilder) => {
            editBuilder.insert(editor.selection.active, step);
        }, { undoStopBefore: false, undoStopAfter: false });
        await sleep(800);
        if (cancelRequested)
            return;
        await editor.edit((editBuilder) => {
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
async function typeText(text) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage("AutoType: No active text editor. Open a file first.");
        return;
    }
    if (isTyping) {
        vscode.window.showWarningMessage("AutoType: Already typing. Stop the current session first.");
        return;
    }
    if (!text || text.length === 0) {
        vscode.window.showWarningMessage("AutoType: Nothing to type – the text is empty.");
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
    let lastPos = editor.selection.active;
    let lastScrolledForLine = -1;
    // Normalize Windows \r\n to Linux \n so we don't double-type enters leading to large spacing bugs.
    const normalizedText = text.replace(/\r\n/g, "\n");
    try {
        for (let i = 0; i < normalizedText.length; i++) {
            if (cancelRequested) {
                vscode.window.showInformationMessage("AutoType: Stopped.");
                break;
            }
            const char = normalizedText[i];
            let position = editor.selection.active;
            // Detect if an asynchronous extension (like Emmet) forcefully inserted text
            // and jumped our cursor forward during the sleep.
            if (lastPos && position.isAfter(lastPos)) {
                const injectedText = editor.document.getText(new vscode.Range(lastPos, position));
                if (injectedText.length > 0 &&
                    normalizedText.substring(i, i + injectedText.length) === injectedText) {
                    // The extension typed these exact upcoming characters for us and moved the cursor past them!
                    // We can skip typing them to avoid duplicates (like '=""').
                    i += injectedText.length;
                    if (i >= normalizedText.length)
                        break;
                    // IMPORTANT: Update char to point to the correct letter after the jump skip
                    // Since the for-loop naturally does i++, we need to decrement i by 1 here
                    // so the loop's i++ brings us to the NEXT character instead of skipping two.
                    i -= 1;
                    lastPos = position;
                    continue;
                }
            }
            const lineText = editor.document.lineAt(position.line).text;
            const charAhead = lineText.substring(position.character, position.character + 1);
            // If the character ahead of the cursor is exactly the character we want to type,
            // AND it's a common auto-closing character, it means an extension auto-inserted it.
            // We skip typing it and just move the cursor forward to prevent duplicates.
            const autoCloseChars = ['"', "'", "`", "}", "]", ")", ">"];
            if (charAhead === char && autoCloseChars.includes(char)) {
                // Just move the cursor forward
                const newPosition = position.translate(0, 1);
                editor.selection = new vscode.Selection(newPosition, newPosition);
            }
            else {
                // Typo simulation using reliable backspace
                if (Math.random() < typoChance && /[a-zA-Z]/.test(char) && i > 0) {
                    const wrongChar = String.fromCharCode(char.charCodeAt(0) + randomBetween(-1, 2));
                    await editor.edit((editBuilder) => {
                        editBuilder.insert(editor.selection.active, wrongChar);
                    }, { undoStopBefore: false, undoStopAfter: false });
                    await sleep(baseSpeed + randomBetween(50, 150));
                    await editor.edit((editBuilder) => {
                        const pos = editor.selection.active;
                        if (pos.character > 0) {
                            editBuilder.delete(new vscode.Range(pos.translate(0, -1), pos));
                        }
                    }, { undoStopBefore: false, undoStopAfter: false });
                    await sleep(baseSpeed + randomBetween(50, 100));
                }
                // Insert the actual character using safe editor.edit bypass
                const isFirst = i === 0;
                const isLast = i === normalizedText.length - 1;
                let success = false;
                let retries = 0;
                while (!success && retries < 10) {
                    success = await editor.edit((editBuilder) => {
                        editBuilder.insert(editor.selection.active, char);
                    }, {
                        undoStopBefore: isFirst && retries === 0,
                        undoStopAfter: isLast && retries === 0,
                    });
                    if (!success) {
                        retries++;
                        // If the edit failed, a concurrent edit (format, auto-close) interrupted. Wait and retry.
                        await sleep(20);
                    }
                }
            }
            lastPos = editor.selection.active;
            // Base delay ± 30% random variation
            const variation = baseSpeed * 0.3;
            let delay = baseSpeed + randomBetween(-variation, variation);
            // Newline extra pause and indent syncing
            if (char === "\n") {
                delay += randomBetween(300, 800);
                // Give extensions a tiny fraction to process the newline
                await sleep(10);
                const newPos = editor.selection.active;
                const newLineText = editor.document.lineAt(newPos.line).text;
                const textBeforeCursor = newLineText.substring(0, newPos.character);
                // If an extension automatically inserted indentation, sync it with our target text
                if (textBeforeCursor.length > 0 && textBeforeCursor.trim() === "") {
                    let matchCount = 0;
                    while (i + 1 + matchCount < normalizedText.length) {
                        const nextChar = normalizedText[i + 1 + matchCount];
                        if ((nextChar === " " || nextChar === "\t") &&
                            matchCount < textBeforeCursor.length) {
                            if (textBeforeCursor[matchCount] === nextChar) {
                                matchCount++;
                            }
                            else {
                                break;
                            }
                        }
                        else {
                            break;
                        }
                    }
                    i += matchCount; // Skip the matching whitespace in our target text
                    // Delete any excess auto-indentation that our target text didn't have
                    if (matchCount < textBeforeCursor.length) {
                        const excess = textBeforeCursor.length - matchCount;
                        const delStart = newPos.translate(0, -excess);
                        await editor.edit((editBuilder) => {
                            editBuilder.delete(new vscode.Range(delStart, newPos));
                        }, { undoStopBefore: false, undoStopAfter: false });
                    }
                }
            }
            // Thinking pause
            charsSinceThinkingPause++;
            if (charsSinceThinkingPause >= nextThinkingPauseAt) {
                delay += randomBetween(200, 600);
                charsSinceThinkingPause = 0;
                nextThinkingPauseAt = randomBetween(5, 15);
            }
            const autoScroll = getAutoScroll();
            if (autoScroll) {
                const currentLine = editor.selection.active.line;
                const visibleRanges = editor.visibleRanges;
                if (visibleRanges.length > 0) {
                    const bottomLine = visibleRanges[visibleRanges.length - 1].end.line;
                    const topLine = visibleRanges[0].start.line;
                    if (currentLine < topLine || currentLine > bottomLine) {
                        editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenter);
                        lastScrolledForLine = currentLine;
                    }
                    else if (currentLine >= bottomLine - 4 &&
                        currentLine > lastScrolledForLine) {
                        const linesToScroll = Math.max(1, currentLine - (bottomLine - 4));
                        vscode.commands.executeCommand("editorScroll", {
                            to: "down",
                            by: "line",
                            value: linesToScroll,
                            revealCursor: false,
                        });
                        lastScrolledForLine = currentLine;
                    }
                }
            }
            await sleep(delay);
        }
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`AutoType: Error while typing – ${message}`);
    }
    finally {
        setTypingContext(false);
    }
}
// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------
async function fromClipboard() {
    try {
        const text = await vscode.env.clipboard.readText();
        if (!text) {
            vscode.window.showWarningMessage("AutoType: Clipboard is empty.");
            return;
        }
        await typeText(text);
    }
    catch {
        vscode.window.showErrorMessage("AutoType: Failed to read clipboard.");
    }
}
async function fromFile() {
    const uris = await vscode.window.showOpenDialog({
        canSelectMany: false,
        openLabel: "Select file to type",
        filters: {
            "Code Files": ["js", "ts", "jsx", "tsx", "html", "css", "py"],
        },
    });
    if (!uris || uris.length === 0) {
        return; // user cancelled
    }
    const filePath = uris[0].fsPath;
    try {
        const content = fs.readFileSync(filePath, "utf-8");
        if (!content) {
            vscode.window.showWarningMessage(`AutoType: File is empty – ${path.basename(filePath)}`);
            return;
        }
        await typeText(content);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`AutoType: Failed to read file – ${message}`);
    }
}
async function setSpeed() {
    const pick = await vscode.window.showQuickPick([
        { label: "🐢  Slow", description: "150 ms per character", value: 150 },
        { label: "🏃  Medium", description: "80 ms per character", value: 80 },
        { label: "⚡  Fast", description: "30 ms per character", value: 30 },
        { label: "✏️  Custom", description: "Enter your own value", value: -1 },
    ], { placeHolder: "Select typing speed" });
    if (!pick) {
        return;
    }
    let speed = pick.value;
    if (speed === -1) {
        const input = await vscode.window.showInputBox({
            prompt: "Enter milliseconds per character",
            value: String(getBaseSpeed()),
            validateInput: (v) => {
                const n = Number(v);
                if (isNaN(n) || n < 1 || !Number.isInteger(n)) {
                    return "Please enter a positive whole number";
                }
                return undefined;
            },
        });
        if (!input) {
            return;
        }
        speed = Number(input);
    }
    const config = vscode.workspace.getConfiguration("autotype");
    await config.update("speed", speed, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`AutoType: Speed set to ${speed} ms per character.`);
}
async function retypeSelection() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage("AutoType: No active text editor.");
        return;
    }
    const selection = editor.selection;
    if (selection.isEmpty) {
        vscode.window.showWarningMessage("AutoType: No text selected to retype.");
        return;
    }
    const text = editor.document.getText(selection);
    // Delete the selected text first
    await editor.edit((editBuilder) => {
        editBuilder.delete(selection);
    });
    // Type it back
    await typeText(text);
}
async function typeContextFile(uri) {
    if (!uri || !uri.fsPath) {
        vscode.window.showErrorMessage("AutoType: No file selected.");
        return;
    }
    try {
        const content = fs.readFileSync(uri.fsPath, "utf-8");
        if (!content) {
            vscode.window.showWarningMessage(`AutoType: File is empty – ${path.basename(uri.fsPath)}`);
            return;
        }
        // Since this is triggered from explorer, we need an active text editor
        // If there isn't one, we should create a new untitled file
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
            const document = await vscode.workspace.openTextDocument({
                language: "plaintext",
            });
            editor = await vscode.window.showTextDocument(document);
        }
        await typeText(content);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`AutoType: Failed to read file – ${message}`);
    }
}
function stop() {
    if (isTyping) {
        cancelRequested = true;
    }
}
// ---------------------------------------------------------------------------
// Activation / Deactivation
// ---------------------------------------------------------------------------
function activate(context) {
    // Status bar
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.command = "workbench.action.quickOpen";
    statusBarItem.text = "$(keyboard) AutoType: Ready";
    statusBarItem.tooltip = "Click to open AutoType commands";
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
    // Override statusbar click to filter commands
    statusBarItem.command = {
        title: "AutoType Commands",
        command: "workbench.action.quickOpen",
        arguments: [">AutoType"],
    };
    // Register commands
    context.subscriptions.push(vscode.commands.registerCommand("autotype.fromClipboard", fromClipboard), vscode.commands.registerCommand("autotype.fromFile", fromFile), vscode.commands.registerCommand("autotype.setSpeed", setSpeed), vscode.commands.registerCommand("autotype.retypeSelection", retypeSelection), vscode.commands.registerCommand("autotype.typeContextFile", typeContextFile), vscode.commands.registerCommand("autotype.stop", stop));
}
function deactivate() {
    cancelRequested = true;
}
//# sourceMappingURL=extension.js.map