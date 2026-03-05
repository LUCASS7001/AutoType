<h1 align="center">
  <img src="banner.svg" alt="AutoType Banner" width="800">
</h1>

<h3 align="center">
  <b>AutoType</b> — Simulate human-like code typing in VS Code.
</h3>

<p align="center">
  Perfect for tutorials, screen recordings, demos, and content creation.
  <br />
  <br />
  <a href="https://open-vsx.org/extension/khalildev/autotype"><img alt="Version" src="https://img.shields.io/badge/version-1.0.0-blue.svg?cacheSeconds=2592000" /></a>
  <a href="#"><img alt="Engine" src="https://img.shields.io/badge/vscode-^1.74.0-brightgreen.svg" /></a>
  <a href="#"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg" /></a>
</p>

---

AutoType types text character by character into your editor with beautifully realistic, human-like pauses. It intentionally makes split-second thinking delays, slowing down on newlines, making your screen recordings look 100% genuine.

## ✨ Features

- **🧠 Human-like pauses** — Base speed with ±30% random variations, plus 200–600ms "thinking" pauses.
- **⏱️ Inline Countdown** — Injects a `3... 2... 1...` countdown directly into your code followed by a 2-second pause before it starts, giving you a perfect window to hit record.
- **🎭 Realistic Typo Simulation** — A configurable chance to strike the wrong key, pause, hit backspace, and correct it naturally.
- **⚡ Smart Auto-Closing** — Cross-platform aware. Skips creating duplicate `<tags>` or `brackets}` when VS Code automatically inserts them for you.
- **🖱️ In-Editor Context Menu** — Right-click anywhere in your file to access all typing commands instantly.
- **🪟 Cross-Platform** — Safely handles Windows `\r\n` line endings to prevent annoying double-spacing bugs.

---

## ⚡ Quick Start

1. Open any file in VS Code.
2. Select a block of text you want to use for a recording.
3. Press `Ctrl+Shift+Alt+R` (or Right-Click -> **AutoType > Retype Selection**).
4. Watch the `3... 2... 1...` countdown, hit record, and let it type out your code!

---

## ⌨️ Commands & Shortcuts

You can access all functions via the Command Palette (`Ctrl+Shift+P`), the Right-Click Context Menu, or these shortcuts:

| Command | Shortcut | What it does |
|---|---|---|
| **Type from Clipboard** | `Ctrl+Shift+Alt+V` | Pastes clipboard contents one character at a time |
| **Retype Selection** | `Ctrl+Shift+Alt+R` | Deletes selected text and instantly re-types it |
| **Type from File** | `Ctrl+Shift+Alt+F` | Picks a source file and types its contents |
| **Type This File** | *(Explorer View)* | Right-click any file in the Sidebar to type it |
| **Set Speed** | — | Choose between Slow, Medium, Fast, or Custom speed |
| **Stop** | `Escape` | Immediately stops any active typing session |

---

## ⚙️ Configuration Settings

Configure AutoType to fit your exact pacing through your VS Code Workspace or User Settings (`settings.json`):

| Setting | Type | Default | Description |
|---|---|---|---|
| `autotype.speed` | `number` | `80` | Base typing speed in milliseconds per character. |
| `autotype.typoChance` | `number` | `0.03` | Likelihood (0.0 to 1.0) of making a deliberate typo that gets auto-corrected. Set to `0` to disable. |

---

## 📦 Installation 

### From source (development)
```bash
git clone https://github.com/LUCASS7001/AutoType.git
cd AutoType
npm install
npm run compile
```
Press **F5** in VS Code to launch the Extension Development Host.

## 👨‍💻 Author

**Khalil** 
- 🌐 Website: [khalildev.cc](https://khalildev.cc)
- 🐙 GitHub: [@LUCASS7001](https://github.com/LUCASS7001)
- 📸 Instagram: [@k_77.0](https://instagram.com/k_77.0)

## 📄 License
[MIT](LICENSE) © Khalil
