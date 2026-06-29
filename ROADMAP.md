# DeepSleep Roadmap

> Public roadmap — updated as features ship.

## ✅ Shipped

| Version | Feature |
|---------|---------|
| v0.1.0 | `ds init` · `ds dream` · `ds chat` · 3-layer local memory · Ollama deepseek-r1 |
| v0.2.0 | MCP server · Cursor · Claude Desktop · Windsurf · 8KB memory · Windows support |
| v0.2.1 | Neural Link · cross-project SQLite FTS5 · `ds search` · `ds link` · `ds neural` |
| v0.2.2 | Rainbow ASCII banner · colored CLI output · star nudge on init |
| v0.2.3 | Cloud API fallback · Anthropic + OpenAI · `ds set-api` · zero new dependencies |

## 🔨 In Progress

- [ ] VS Code extension — memory sidebar, no terminal needed
- [ ] Auto-sync on `git commit` — Neural Link updates on every commit automatically

## 📋 Planned

- [ ] `ds review` — AI code review using your own project memory as context
- [ ] Team shared memory — sync `.deepsleep/` across a team via git
- [ ] `ds diff` — explain what changed since last session
- [ ] Web UI dashboard — browse memory, search history, manage Neural Link
- [ ] GitHub Actions integration — `ds dream` in CI, post session summary as PR comment
- [ ] More local models — llama3, mistral, phi3, codellama via Ollama

## 💡 Under Consideration

- Browser extension — carry coding context into AI chat tools
- JetBrains plugin
- Neovim plugin
- Obsidian plugin — export DeepSleep memory to Obsidian vault

## Contributing

Want to work on any of these? Open an issue and let's talk.
Check [CONTRIBUTING.md](./CONTRIBUTING.md) for setup instructions.
