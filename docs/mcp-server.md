# DeepSleep MCP Server

DeepSleep ships a Model Context Protocol (MCP) server that gives Cursor, Windsurf, and Claude Desktop direct access to your local project memory.

## What is MCP?

MCP (Model Context Protocol) is an open standard for connecting AI tools to external data sources. DeepSleep implements it so your IDE's AI can read your session memory, search across projects, and ask questions about what you were working on — without you having to paste context manually.

## Install

```bash
pip install deepsleep-ai[mcp]
```

## Configure for Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "deepsleep": {
      "command": "ds",
      "args": ["mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

## Configure for Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "deepsleep": {
      "command": "ds",
      "args": ["mcp"],
      "cwd": "/path/to/your/project"
    }
  }
}
```

## Available MCP tools

| Tool | Description |
|------|-------------|
| `get_memory` | Full 3-layer memory (project/session/ephemeral) |
| `update_project_note` | Add a fact to project memory |
| `get_session_summary` | Latest dream summary |
| `get_recent_files` | Files changed in this session |
| `get_open_questions` | Open questions from memory |
| `neural_search` | Search across all linked projects |
| `neural_link_project` | Link a new project to Neural Link |
| `neural_status` | Status of all linked projects |
| `neural_classify` | Classify recent changes |
| `neural_context` | Global cross-project context |

## Start manually

```bash
ds mcp                          # start MCP server for current directory
ds mcp --project /path/to/proj  # explicit project root
```
