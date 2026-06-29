import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export interface DeepSleepMemory {
  project: { summary: string; goals: string[]; facts: string[] };
  session: {
    summary: string;
    recent_files: string[];
    recent_tasks: string[];
    last_dream_at: string | null;
  };
  ephemeral: {
    last_user_message: string;
    last_assistant_message: string;
    recent_changes: string[];
  };
  meta: {
    project_root: string;
    created_at: string;
    updated_at: string;
    last_model: string;
  };
}

export interface ActivityEvent {
  timestamp: string;
  type: "file_event" | "chat_turn" | "dream";
  payload: Record<string, unknown>;
}

export interface SidebarData {
  memory: DeepSleepMemory | null;
  dreams: ActivityEvent[];
  fileEvents: ActivityEvent[];
  dataDir: string;
  projectRoot: string | null;
}

export function resolveDataDir(workspacePath?: string): string {
  const cfg = vscode.workspace
    .getConfiguration("deepsleep")
    .get<string>("globalDataDir");
  if (cfg && cfg.trim()) return cfg.trim();

  // Check per-project .deepsleep first
  if (workspacePath) {
    const local = path.join(workspacePath, ".deepsleep");
    if (fs.existsSync(path.join(local, "memory.json"))) return local;
  }

  return path.join(os.homedir(), ".deepsleep");
}

export function readMemory(dataDir: string): DeepSleepMemory | null {
  const memPath = path.join(dataDir, "memory.json");
  if (!fs.existsSync(memPath)) return null;
  try {
    const raw = fs.readFileSync(memPath, "utf-8");
    // Bail out if it looks encrypted
    if (raw.startsWith("DS_V1_ENC:") || /^[A-Za-z0-9+/]{60,}={0,2}$/.test(raw.substring(0, 30))) {
      return null;
    }
    return JSON.parse(raw) as DeepSleepMemory;
  } catch {
    return null;
  }
}

export function readActivity(
  dataDir: string,
  limit: number = 200
): ActivityEvent[] {
  const logPath = path.join(dataDir, "activity.jsonl");
  if (!fs.existsSync(logPath)) return [];
  try {
    const lines = fs.readFileSync(logPath, "utf-8").trim().split("\n");
    const last = lines.slice(-limit);
    return last
      .filter((l) => l.trim())
      .map((l) => {
        try {
          return JSON.parse(l) as ActivityEvent;
        } catch {
          return null;
        }
      })
      .filter((e): e is ActivityEvent => e !== null)
      .reverse();
  } catch {
    return [];
  }
}

export function loadSidebarData(): SidebarData {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  const workspacePath = workspaceFolders?.[0]?.uri?.fsPath;
  const dataDir = resolveDataDir(workspacePath);

  const memory = readMemory(dataDir);
  const allEvents = readActivity(dataDir, 300);

  const dreams = allEvents.filter((e) => e.type === "dream").slice(0, 20);
  const fileEvents = allEvents.filter((e) => e.type === "file_event").slice(0, 100);

  return {
    memory,
    dreams,
    fileEvents,
    dataDir,
    projectRoot: memory?.meta?.project_root ?? workspacePath ?? null,
  };
}
