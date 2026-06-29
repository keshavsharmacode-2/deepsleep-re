import * as path from "path";
import * as vscode from "vscode";
import { loadSidebarData } from "./DataReader";
import { SessionTracker } from "./SessionTracker";
import { SidebarProvider } from "./SidebarProvider";

let _tracker: SessionTracker | undefined;
let _provider: SidebarProvider | undefined;

export function activate(context: vscode.ExtensionContext): void {
  _tracker = new SessionTracker();
  _provider = new SidebarProvider(context.extensionUri, _tracker);

  // Register sidebar
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(SidebarProvider.viewId, _provider, {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("deepsleep.resumeSession", () => {
      _provider?.resumeSession();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("deepsleep.refreshSidebar", () => {
      _provider?.refresh();
    })
  );

  // Context cards: show inline notification when reopening a file after a break
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (!editor || editor.document.uri.scheme !== "file") return;
      _maybeShowContextCard(editor.document.uri.fsPath);
    })
  );

  context.subscriptions.push(_tracker);
}

export function deactivate(): void {
  _tracker?.dispose();
}

function _maybeShowContextCard(filePath: string): void {
  const cfg = vscode.workspace.getConfiguration("deepsleep");
  if (!cfg.get<boolean>("contextCardOnReopen", true)) return;

  const breakMinutes = cfg.get<number>("contextCardBreakMinutes", 60);

  if (!_tracker) return;

  // Only fire if they haven't opened this file recently (break detection)
  const isReturn = _tracker.isReturningAfterBreak(filePath, breakMinutes);
  if (!isReturn) {
    // Check if it's a known recent file from memory
    const data = loadSidebarData();
    const recentFiles = data.memory?.session?.recent_files ?? [];
    const base = path.basename(filePath);
    const isKnown = recentFiles.some(
      (f) => path.basename(f) === base || filePath.includes(f)
    );
    if (!isKnown) return;
  }

  // Don't show if they've been active in the last 5 minutes (not a real break)
  const idleMs = Date.now() - _tracker.getLastActiveAt();
  if (idleMs < 5 * 60 * 1000 && !isReturn) return;

  const data = loadSidebarData();
  const summary = data.memory?.session?.summary ?? "";
  const name = path.basename(filePath);

  vscode.window
    .showInformationMessage(
      `💤 DeepSleep: Resuming work on ${name}`,
      "Show Context",
      "Dismiss"
    )
    .then((choice) => {
      if (choice === "Show Context") {
        vscode.commands.executeCommand("deepsleep.sidebar.focus");
      }
    });
}
