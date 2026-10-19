// 데이터 접근 단일 지점(서버). 지금은 메모리 목업, 3단계에서 Spring/Python 호출로 교체한다.
// 클라이언트 컴포넌트는 lib/api/client.ts 를 통해 app/api/mock/* 라우트를 호출한다.
import type { Workspace, User, LogNode, LogCounts, Chain, ChainNode, LogType } from "@/lib/types/domain";
import workspaces from "@/mocks/workspaces.json";
import users from "@/mocks/users.json";
import { store } from "@/lib/api/store";

export async function getWorkspaces(): Promise<Workspace[]> {
  return workspaces as Workspace[];
}
export async function getWorkspace(id: number): Promise<Workspace | undefined> {
  return (workspaces as Workspace[]).find((w) => w.id === id);
}
export async function getUsers(): Promise<User[]> {
  return users as User[];
}

export async function getLogs(wsId: number, opts: { type?: LogType | "all"; q?: string } = {}): Promise<{ items: LogNode[]; counts: LogCounts }> {
  const all = store.nodes.filter((l) => l.workspace_id === wsId);
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
    items = items.filter((l) => l.title.toLowerCase().includes(q) || l.error_code?.toLowerCase().includes(q) || l.keywords.some((k) => k.toLowerCase().includes(q)));
  }
  return { items: [...items].sort((a, b) => b.created_at.localeCompare(a.created_at)), counts };
}

export async function getRecentLogs(wsId: number, limit = 5): Promise<LogNode[]> {
  return (await getLogs(wsId)).items.slice(0, limit);
}

export async function getWeeklyCount(wsId: number): Promise<number> {
  // TODO:04 백엔드 집계(쟁점 2). 목업: 최근 7일 등록 수
  const since = Date.now() - 7 * 86400_000;
  return store.nodes.filter((l) => l.workspace_id === wsId && Date.parse(l.created_at) >= since).length;
}

// get_chain(ws, entry, max_depth=3): 조상(음수 depth)·자손(양수 depth). 04 §3.3 의미와 동일
export async function getChain(wsId: number, entryId: number, maxDepth = 3): Promise<Chain | null> {
  const byId = new Map(store.nodes.filter((n) => n.workspace_id === wsId).map((n) => [n.id, n]));
  if (!byId.has(entryId)) return null;
  const depth = new Map<number, number>([[entryId, 0]]);
  const walk = (id: number, d: number, dir: "up" | "down") => {
    if (Math.abs(d) >= maxDepth) return;
    for (const e of store.edges) {
      const next = dir === "up" ? (e.child_id === id ? e.parent_id : null) : e.parent_id === id ? e.child_id : null;
      if (next == null || !byId.has(next)) continue;
      const nd = dir === "up" ? d - 1 : d + 1;
      if (!depth.has(next) || Math.abs(depth.get(next)!) > Math.abs(nd)) {
        depth.set(next, nd);
        walk(next, nd, dir);
      }
    }
  };
  walk(entryId, 0, "up");
  walk(entryId, 0, "down");
  if (depth.size === 1 && !store.edges.some((e) => e.parent_id === entryId || e.child_id === entryId)) return null;
  const nodes: ChainNode[] = [...depth.entries()].map(([id, d]) => {
    const n = byId.get(id)!;
    return { id, type: n.type, status: n.status, title: n.title, depth: d, path_label: n.path_label, note: n.resolution_summary, last_confirmed_at: n.last_confirmed_at };
  });
  const ids = new Set(depth.keys());
  const edges = store.edges.filter((e) => ids.has(e.parent_id) && ids.has(e.child_id));
  const root = nodes.find((n) => n.depth === Math.min(...nodes.map((x) => x.depth)));
  return { entry_id: entryId, nodes, edges, summary: root ? `${root.title} 체인: 노드 ${nodes.length}개, 해결 ${nodes.filter((n) => n.type === "success" && n.status === "active").length}건. (AI 요약은 3단계에서 LLM 호출로 대체)` : null };
}

export async function createLog(
  wsId: number,
  input: { type: LogType; title: string; body: string; parent_id: number | null; author_name?: string },
): Promise<LogNode> {
  const id = store.nextId++;
  const parent = input.parent_id ? store.nodes.find((n) => n.id === input.parent_id) : undefined;
  const node: LogNode = {
    id,
    workspace_id: wsId,
    type: input.type,
    status: "active",
    title: input.title,
    body: input.body,
    author_name: input.author_name ?? "배종현",
    path_label: parent ? `${parent.path_label}.n${id}` : `root.n${id}`,
    error_code: /([A-Z]{1,4}-?\d{3,4}|HTTP\s?\d{3})/.exec(`${input.title} ${input.body}`)?.[0] ?? null,
    keywords: [],
    resolution_summary: null,
    refine_status: "pending",
    last_confirmed_at: null,
    created_at: new Date().toISOString(),
  };
  store.nodes.push(node);
  if (parent) store.edges.push({ parent_id: parent.id, child_id: id });
  return node;
}
