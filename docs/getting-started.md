# Getting Started with DeepSleep

**DeepSleep** is a free, local-first AI memory tool for developers. It runs in the background, watches your project files, and generates natural language summaries of what you were working on — so you never have to re-explain your codebase to an AI assistant again.

No cloud. No API key required. No subscription. Works on macOS, Linux, and Windows.

## Install in 60 seconds

```bash
pip install deepsleep-ai
cd your-project
ds init
ds watch
```

That's it. DeepSleep is now watching your project. When you go idle, it dreams — reads what you touched and writes a summary locally.

## Ask it anything

```bash
ds chat
> what was I working on?
> show me the files I changed today
> summarize the auth module
```

## Works with your existing tools

| Tool | How |
|------|-----|
| **VS Code** | Install the Memory Sidebar extension — live dream feed, file heatmap, one-click resume |
| **Cursor** | Run `ds mcp` and add to `.cursor/mcp.json` |
| **Windsurf** | Same as Cursor — MCP protocol |
| **Claude Desktop** | Add to `claude_desktop_config.json` |
| **Terminal** | `ds chat`, `ds dream`, `ds search` |

## Requirements

- Python 3.9+
- [Ollama](https://ollama.com) (optional but recommended — enables local LLM dreaming)
- VS Code 1.85+ (for the Memory Sidebar extension)

## What it costs

**$0 forever.** DeepSleep runs on your machine using Ollama (free, local). If you want a cloud fallback for when Ollama is offline, you can optionally add a Claude or OpenAI API key — but it's never required.

## Next steps

- [Full README](../README.md)
- [Neural Link — cross-project memory](./neural-link.md)
- [VS Code Extension](./vscode-extension.md)
- [MCP Server setup](./mcp-server.md)
