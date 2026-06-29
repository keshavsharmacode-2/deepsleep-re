# DeepSleep VS Code Extension — Memory Sidebar

A visual sidebar for VS Code that shows your coding session memory in real time.

## What it does

- **Dream Feed** — live AI summary of your last coding session
- **File Heatmap** — every file you've opened this session, ranked by access count
- **Dream Timeline** — history of every session summary DeepSleep has generated
- **Resume Session** — one click reopens the last 8 files from your previous session
- **Context Cards** — when you reopen a file after 60+ minutes away, a toast appears reminding you what you were doing

## Install

```bash
git clone https://github.com/Keshavsharma-code/DeepSleep-beta.git
cd DeepSleep-beta/vscode-extension
npm install
npx @vscode/vsce package
code --install-extension deepsleep-memory-0.1.0.vsix
```

## How it works

The extension reads your `.deepsleep/memory.json` and `activity.jsonl` directly — no CLI needs to be running. It watches the memory file for changes and updates the sidebar automatically when DeepSleep generates a new dream.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `deepsleep.contextCardOnReopen` | `true` | Show context toast on file reopen |
| `deepsleep.contextCardBreakMinutes` | `60` | Idle minutes before reopen counts as a break |
| `deepsleep.globalDataDir` | auto | Override `~/.deepsleep` path |

## Requirements

- VS Code 1.85+
- DeepSleep (`pip install deepsleep-ai`) initialized in your project with `ds init`
