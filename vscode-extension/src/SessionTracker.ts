import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { resolveDataDir } from "./DataReader";

export interface FileAccessRecord {
  file: string;
  openCount: number;
  firstOpenAt: number;
  lastOpenAt: number;
}

export class SessionTracker {
  private _fileAccess = new Map<string, FileAccessRecord>();
  private _sessionStartAt = Date.now();
  private _lastActiveAt = Date.now();
  private _disposables: vscode.Disposable[] = [];

  constructor() {
    this._disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor?.document.uri.scheme === "file") {
          this._recordOpen(editor.document.uri.fsPath);
        }
      })
    );

    // Record the currently open file on startup
    const active = vscode.window.activeTextEditor;
    if (active?.document.uri.scheme === "file") {
      this._recordOpen(active.document.uri.fsPath);
    }
  }

  private _recordOpen(filePath: string): void {
    const now = Date.now();
    this._lastActiveAt = now;

    const existing = this._fileAccess.get(filePath);
    if (existing) {
      existing.openCount++;
      existing.lastOpenAt = now;
    } else {
      this._fileAccess.set(filePath, {
        file: filePath,
        openCount: 1,
        firstOpenAt: now,
        lastOpenAt: now,
      });
    }

    this._writeVSCodeActivity(filePath, now);
  }

  private _writeVSCodeActivity(filePath: string, now: number): void {
    try {
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const workspacePath = workspaceFolders?.[0]?.uri?.fsPath;
      const dataDir = resolveDataDir(workspacePath);

      if (!fs.existsSync(dataDir)) return;

      const logPath = path.join(dataDir, "activity.jsonl");
      const relPath = workspacePath
        ? path.relative(workspacePath, filePath)
        : filePath;

      const record = JSON.stringify({
        timestamp: new Date(now).toISOString(),
        type: "file_event",
        payload: { path: relPath, event_type: "vscode_open" },
      });

      fs.appendFileSync(logPath, record + "\n", "utf-8");
    } catch {
      // non-critical
    }
  }

  getHeatmap(): FileAccessRecord[] {
    return [...this._fileAccess.values()].sort(
      (a, b) => b.openCount - a.openCount
    );
  }

  getSessionDurationMs(): number {
    return Date.now() - this._sessionStartAt;
  }

  getLastActiveAt(): number {
    return this._lastActiveAt;
  }

  isReturningAfterBreak(filePath: string, breakMinutes: number): boolean {
    const record = this._fileAccess.get(filePath);
    if (!record) return false;
    const idleMs = Date.now() - record.lastOpenAt;
    return idleMs > breakMinutes * 60 * 1000;
  }

  dispose(): void {
    this._disposables.forEach((d) => d.dispose());
  }
}
