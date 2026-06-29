import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { loadSidebarData, resolveDataDir, SidebarData } from "./DataReader";
import { FileAccessRecord, SessionTracker } from "./SessionTracker";

export class SidebarProvider implements vscode.WebviewViewProvider {
  static readonly viewId = "deepsleep.sidebar";

  private _view?: vscode.WebviewView;
  private _memWatcher?: fs.FSWatcher;
  private _lastRefreshAt = 0;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _tracker: SessionTracker
  ) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };
    webviewView.webview.html = this._getHtml();
    webviewView.webview.onDidReceiveMessage((msg) => this._handleMessage(msg));

    // Auto-refresh when the panel becomes visible
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) this._sendData();
    });

    this._watchMemoryFile();
    this._sendData();
  }

  refresh(): void {
    this._sendData();
  }

  async resumeSession(): Promise<void> {
    const data = loadSidebarData();
    const files = data.memory?.session?.recent_files ?? [];
    if (!files.length) {
      vscode.window.showInformationMessage("DeepSleep: No recent files to restore.");
      return;
    }

    const root = data.projectRoot ?? "";
    let opened = 0;
    for (const rel of files.slice(-8).reverse()) {
      const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
      if (!fs.existsSync(abs)) continue;
      try {
        const doc = await vscode.workspace.openTextDocument(abs);
        await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
        opened++;
      } catch {
        // skip unreadable files
      }
    }
    vscode.window.showInformationMessage(
      `DeepSleep: Restored ${opened} file${opened !== 1 ? "s" : ""} from last session.`
    );
  }

  private _handleMessage(msg: { type: string; payload?: unknown }): void {
    switch (msg.type) {
      case "ready":
        this._sendData();
        break;
      case "resumeSession":
        this.resumeSession();
        break;
      case "openFile": {
        const rel = msg.payload as string;
        const data = loadSidebarData();
        const root = data.projectRoot ?? "";
        const abs = path.isAbsolute(rel) ? rel : path.join(root, rel);
        if (fs.existsSync(abs)) {
          vscode.workspace.openTextDocument(abs).then((doc) =>
            vscode.window.showTextDocument(doc)
          );
        }
        break;
      }
    }
  }

  private _sendData(): void {
    if (!this._view) return;
    const now = Date.now();
    if (now - this._lastRefreshAt < 500) return; // debounce
    this._lastRefreshAt = now;

    const data = loadSidebarData();
    const heatmap = this._tracker.getHeatmap().slice(0, 12);
    const sessionDurationMs = this._tracker.getSessionDurationMs();

    this._view.webview.postMessage({
      type: "data",
      payload: { data, heatmap, sessionDurationMs },
    });
  }

  private _watchMemoryFile(): void {
    this._memWatcher?.close();
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspacePath = workspaceFolders?.[0]?.uri?.fsPath;
      const dataDir = resolveDataDir(workspacePath);
      const memPath = path.join(dataDir, "memory.json");

      if (!fs.existsSync(memPath)) return;

      this._memWatcher = fs.watch(memPath, () => {
        setTimeout(() => this._sendData(), 300);
      });
    } catch {
      // non-critical
    }
  }

  private _getHtml(): string {
    return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';">
<style>
  :root {
    --bg: var(--vscode-sideBar-background, #1e1e1e);
    --fg: var(--vscode-foreground, #ccc);
    --border: var(--vscode-panel-border, #333);
    --accent: #c0392b;
    --accent2: #e74c3c;
    --card-bg: var(--vscode-editor-background, #252526);
    --muted: var(--vscode-descriptionForeground, #888);
    --hover: var(--vscode-list-hoverBackground, #2a2d2e);
    --badge: #922b21;
    --green: #27ae60;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--vscode-font-family, system-ui);
    font-size: 12px;
    color: var(--fg);
    background: var(--bg);
    padding: 0;
    overflow-x: hidden;
  }

  /* ---------- Header ---------- */
  .header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px 8px;
    border-bottom: 1px solid var(--border);
  }
  .header-icon { font-size: 18px; }
  .header-title { font-size: 13px; font-weight: 600; flex: 1; }
  .session-pill {
    background: var(--badge);
    color: #fff;
    font-size: 10px;
    padding: 2px 7px;
    border-radius: 10px;
    letter-spacing: 0.3px;
  }

  /* ---------- Sections ---------- */
  .section { padding: 10px 12px; border-bottom: 1px solid var(--border); }
  .section-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.8px;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 8px;
  }

  /* ---------- Dream Card ---------- */
  .dream-card {
    background: var(--card-bg);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    border-radius: 4px;
    padding: 8px 10px;
  }
  .dream-summary {
    font-size: 12px;
    line-height: 1.5;
    color: var(--fg);
    white-space: pre-wrap;
  }
  .dream-meta {
    margin-top: 6px;
    font-size: 10px;
    color: var(--muted);
    display: flex;
    gap: 8px;
  }
  .dream-dot {
    display: inline-block;
    width: 6px;
    height: 6px;
    background: var(--green);
    border-radius: 50%;
    animation: pulse 2s infinite;
    margin-right: 4px;
    vertical-align: middle;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }

  /* ---------- Heatmap ---------- */
  .heatmap-row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 0;
    cursor: pointer;
    border-radius: 3px;
    padding: 4px 6px;
    margin: 0 -6px;
  }
  .heatmap-row:hover { background: var(--hover); }
  .heatmap-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
  }
  .heatmap-bar-wrap {
    width: 60px;
    height: 6px;
    background: var(--border);
    border-radius: 3px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .heatmap-bar {
    height: 100%;
    background: linear-gradient(90deg, var(--badge), var(--accent2));
    border-radius: 3px;
    transition: width 0.4s ease;
  }
  .heatmap-count {
    font-size: 10px;
    color: var(--muted);
    width: 20px;
    text-align: right;
    flex-shrink: 0;
  }

  /* ---------- Timeline ---------- */
  .timeline-empty {
    font-size: 11px;
    color: var(--muted);
    font-style: italic;
    text-align: center;
    padding: 12px 0;
  }
  .timeline-item {
    display: flex;
    gap: 10px;
    padding: 6px 0;
    position: relative;
  }
  .timeline-item + .timeline-item { border-top: 1px solid var(--border); }
  .timeline-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent);
    flex-shrink: 0;
    margin-top: 3px;
  }
  .timeline-content { flex: 1; overflow: hidden; }
  .timeline-time { font-size: 10px; color: var(--muted); margin-bottom: 2px; }
  .timeline-text {
    font-size: 11px;
    line-height: 1.4;
    color: var(--fg);
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
  }
  .timeline-files {
    margin-top: 4px;
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }
  .timeline-file-tag {
    background: var(--border);
    border-radius: 3px;
    padding: 1px 5px;
    font-size: 10px;
    color: var(--muted);
  }

  /* ---------- Resume Button ---------- */
  .resume-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .resume-btn:hover { background: var(--accent2); }
  .resume-btn:active { transform: scale(0.98); }

  /* ---------- Context Block ---------- */
  .project-summary {
    font-size: 11px;
    line-height: 1.5;
    color: var(--muted);
    font-style: italic;
  }

  /* ---------- Empty / Loading ---------- */
  .loading {
    text-align: center;
    padding: 40px 16px;
    color: var(--muted);
    font-size: 12px;
  }
  .loading .icon { font-size: 32px; margin-bottom: 8px; }
  .no-data {
    text-align: center;
    padding: 24px 16px;
    color: var(--muted);
    font-size: 11px;
  }

  /* ---------- Tasks list ---------- */
  .task-item {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    padding: 3px 0;
    font-size: 11px;
    color: var(--fg);
    line-height: 1.4;
  }
  .task-bullet {
    color: var(--accent);
    font-size: 14px;
    line-height: 1;
    margin-top: 0px;
    flex-shrink: 0;
  }
</style>
</head>
<body>
<div id="root">
  <div class="loading">
    <div class="icon">💤</div>
    <div>Loading memory...</div>
  </div>
</div>

<script>
const vscode = acquireVsCodeApi();

function relTime(isoStr) {
  if (!isoStr) return "never";
  const diff = Date.now() - new Date(isoStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

function fmtDuration(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 60) return m + "m";
  return Math.floor(m / 60) + "h " + (m % 60) + "m";
}

function basename(p) {
  return p ? p.split(/[\\/]/).pop() || p : "";
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render(payload) {
  const { data, heatmap, sessionDurationMs } = payload;
  const mem = data.memory;
  const root = document.getElementById("root");

  if (!mem) {
    root.innerHTML = \`
      <div class="no-data">
        <div style="font-size:28px;margin-bottom:8px;">💤</div>
        <strong>No DeepSleep data found</strong><br><br>
        Run <code>ds init</code> in your project to start capturing memory.
      </div>\`;
    return;
  }

  const session = mem.session;
  const project = mem.project;
  const dreams = data.dreams;

  // Combine historical + vscode-tracked files for heatmap
  const allHeatFiles = heatmap.slice(0, 8);
  const histFiles = (session.recent_files || []).filter(f =>
    !allHeatFiles.find(h => h.file.includes(f) || f.includes(basename(h.file)))
  ).slice(0, 6);

  const maxCount = allHeatFiles.length > 0 ? allHeatFiles[0].openCount : 1;

  let html = \`
  <!-- Header -->
  <div class="header">
    <span class="header-icon">💤</span>
    <span class="header-title">Memory Sidebar</span>
    <span class="session-pill">\${fmtDuration(sessionDurationMs)}</span>
  </div>\`;

  // ---- Dream / Session Summary ----
  const hasDream = session.summary && session.summary !== "No session summary yet.";
  html += \`<div class="section">
    <div class="section-label">
      <span class="dream-dot"></span>Last Dream
    </div>
    <div class="dream-card">
      <div class="dream-summary">\${escHtml(hasDream ? session.summary : "No dream recorded yet. Start ds init in your project to begin.")}</div>
      <div class="dream-meta">
        <span>Dreamed \${relTime(session.last_dream_at)}</span>
        <span>·</span>
        <span>\${mem.meta.last_model}</span>
      </div>
    </div>
  </div>\`;

  // ---- Recent Tasks ----
  const tasks = session.recent_tasks || [];
  if (tasks.length > 0) {
    html += \`<div class="section">
      <div class="section-label">Recent Tasks</div>\`;
    tasks.slice(-5).reverse().forEach(t => {
      html += \`<div class="task-item"><span class="task-bullet">›</span><span>\${escHtml(t)}</span></div>\`;
    });
    html += \`</div>\`;
  }

  // ---- File Heatmap ----
  html += \`<div class="section">
    <div class="section-label">File Heatmap</div>\`;

  if (allHeatFiles.length === 0 && histFiles.length === 0) {
    html += \`<div class="timeline-empty">No file activity yet this session.</div>\`;
  } else {
    allHeatFiles.forEach(f => {
      const pct = Math.round((f.openCount / maxCount) * 100);
      const name = basename(f.file);
      html += \`<div class="heatmap-row" data-file="\${escHtml(f.file)}" onclick="openFile('\${escHtml(f.file)}')">
        <span class="heatmap-name" title="\${escHtml(f.file)}">\${escHtml(name)}</span>
        <div class="heatmap-bar-wrap"><div class="heatmap-bar" style="width:\${pct}%"></div></div>
        <span class="heatmap-count">\${f.openCount}</span>
      </div>\`;
    });
    histFiles.forEach(f => {
      const name = basename(f);
      html += \`<div class="heatmap-row" data-file="\${escHtml(f)}" onclick="openFile('\${escHtml(f)}')">
        <span class="heatmap-name" title="\${escHtml(f)}">\${escHtml(name)}</span>
        <div class="heatmap-bar-wrap"><div class="heatmap-bar" style="width:20%"></div></div>
        <span class="heatmap-count">—</span>
      </div>\`;
    });
  }
  html += \`</div>\`;

  // ---- Dream Timeline ----
  html += \`<div class="section">
    <div class="section-label">Dream Timeline</div>\`;

  if (dreams.length === 0) {
    html += \`<div class="timeline-empty">No dreams yet. Idle for 5 min while ds watch runs to trigger one.</div>\`;
  } else {
    dreams.slice(0, 10).forEach(d => {
      const summary = (d.payload.summary || "") as string;
      const files = (d.payload.files || []) as string[];
      html += \`<div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-time">\${relTime(d.timestamp)}</div>
          <div class="timeline-text">\${escHtml(summary)}</div>
          <div class="timeline-files">
            \${files.slice(0, 5).map(f => \`<span class="timeline-file-tag">\${escHtml(basename(f))}</span>\`).join("")}
          </div>
        </div>
      </div>\`;
    });
  }
  html += \`</div>\`;

  // ---- Project Context ----
  const projSummary = project.summary;
  if (projSummary && projSummary !== "Project memory is empty. Capture the repo purpose here.") {
    html += \`<div class="section">
      <div class="section-label">Project Context</div>
      <div class="project-summary">\${escHtml(projSummary)}</div>
    </div>\`;
  }

  // ---- Resume Session Button ----
  html += \`<div class="section" style="border-bottom:none">
    <button class="resume-btn" onclick="resumeSession()">
      ▶ Resume Session
    </button>
  </div>\`;

  root.innerHTML = html;
}

function resumeSession() {
  vscode.postMessage({ type: "resumeSession" });
}

function openFile(filePath) {
  vscode.postMessage({ type: "openFile", payload: filePath });
}

window.addEventListener("message", e => {
  const msg = e.data;
  if (msg.type === "data") render(msg.payload);
  if (msg.type === "contextCard") showContextCard(msg.payload);
});

function showContextCard(payload) {
  const banner = document.createElement("div");
  banner.style.cssText = \`
    position:fixed;top:0;left:0;right:0;
    background:var(--accent);color:#fff;
    padding:8px 12px;font-size:11px;
    display:flex;align-items:center;gap:8px;
    z-index:9999;animation:slideIn 0.2s ease;
  \`;
  banner.innerHTML = \`<span>💤 You were here: <strong>\${escHtml(payload.file)}</strong></span>
    <span style="margin-left:auto;cursor:pointer;font-size:14px" onclick="this.parentElement.remove()">×</span>\`;

  const style = document.createElement("style");
  style.textContent = "@keyframes slideIn{from{transform:translateY(-100%)}to{transform:translateY(0)}}";
  document.head.appendChild(style);
  document.body.prepend(banner);
  setTimeout(() => banner.remove(), 5000);
}

// Signal ready
vscode.postMessage({ type: "ready" });
</script>
</body>
</html>`;
  }
}
