// 데이터 접근 단일 지점. 지금은 mocks/ 를 읽고, 3단계에서 NEXT_PUBLIC_API_BASE 로 교체한다.
import type { Workspace, User, LogNode, LogCounts, Chain, LogType } from "@/lib/types/domain";
import workspaces from "@/mocks/workspaces.json";
import users from "@/mocks/users.json";
import logs from "@/mocks/logs.json";
import chainE403 from "@/mocks/chain-e403.json";


export async function getWorkspaces(): Promise<Workspace[]> {
  return workspaces as Workspace[];
}

export async function getWorkspace(id: number): Promise<Workspace | undefined> {
  return (workspaces as Workspace[]).find((w) => w.id === id);
}

export async function getUsers(): Promise<User[]> {
  return users as User[];
}

export async function getLogs(
  wsId: number,
  opts: { type?: LogType | "all"; q?: string } = {},
): Promise<{ items: LogNode[]; counts: LogCounts }> {
  const all = (logs as LogNode[]).filter((l) => l.workspace_id === wsId);
  const counts: LogCounts = {
    all: all.length,
    fail: all.filter((l) => l.type === "fail").length,
    success: all.filter((l) => l.type === "success").length,
    ref: all.filter((l) => l.type === "ref").length,
  };
  let items = all;
  if (opts.type && opts.type !== "all") items = items.filter((l) => l.type === opts.type);
  if (opts.q) {
    const q = opts.q.toLowerCase();
    items = items.filter(
      (l) => l.title.toLowerCase().includes(q) || l.error_code?.toLowerCase().includes(q) || l.keywords.some((k) => k.toLowerCase().includes(q)),
    );
  }
  items = [...items].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { items, counts };
}

export async function getRecentLogs(wsId: number, limit = 3): Promise<LogNode[]> {
  const { items } = await getLogs(wsId);
  return items.slice(0, limit);
}

export async function getWeeklyCount(wsId: number): Promise<number> {
  // TODO:04 백엔드 집계로 이동 (쟁점 2). 목업은 고정값.
  void wsId;
  return 17;
}

export async function getChain(wsId: number, entryId: number): Promise<Chain | null> {
  if (wsId === 1 && [101, 106, 107, 108, 102, 103, 109].includes(entryId)) return chainE403 as Chain;
  return null;
}
