# Neural Link — Cross-Project AI Memory

Neural Link connects every project on your machine into one searchable brain.

## The problem it solves

You fixed a JWT validation bug three weeks ago. You know you did. You can't remember which repo.

```bash
ds search "jwt validation"
```

Neural Link finds it in 200ms across every project you've ever linked — with full-text search powered by SQLite FTS5.

## Setup

```bash
# Link your projects
ds link ~/work/api-server
ds link ~/personal/saas-app
ds link ~/client/mobile-backend

# Search across all of them
ds search "rate limiting"
ds search "auth middleware"
ds search "database migration"
```

## How it works

Neural Link builds a local SQLite index of all your linked projects. It stores:
- Session summaries from every dream
- File change history
- Chat history
- Pattern classifications (bug fixes, refactors, new features)

Everything lives on your machine. Nothing leaves.

## MCP tools for Cursor / Windsurf

When running as an MCP server, Neural Link exposes:

| Tool | What it does |
|------|-------------|
| `neural_search` | Full-text search across all linked projects |
| `neural_link_project` | Add a project to the index |
| `neural_status` | See all linked projects and their last dream time |
| `neural_classify` | Classify recent changes by type (bug/feature/refactor) |
| `neural_context` | Get global context across all projects |
