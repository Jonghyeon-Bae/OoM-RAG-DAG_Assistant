// 데이터 접근 단일 지점(서버). 지금은 메모리 목업, 3단계에서 Spring/Python 호출로 교체한다.
// 클라이언트 컴포넌트는 lib/api/client.ts 를 통해 app/api/mock/* 라우트를 호출한다.
import type { Workspace, User, LogNode, LogCounts, Chain, ChainNode, LogType } from "@/lib/types/domain";
import workspaces from "@/mocks/workspaces.json";
import users from "@/mocks/users.json";
import { connection } from "next/server";
import { store, type StoreNode } from "@/lib/api/store";

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
  await connection(); // Date.now() 기반 목업 상태 전이는 요청 시점에만 (Cache Components 프리렌더 제외)
  const all = store.nodes.filter((l) => l.workspace_id === wsId).map(settle).map(withRoot);
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
  await connection(); // Date.now() 기반 목업 상태 전이는 요청 시점에만 (Cache Components 프리렌더 제외)
  // TODO:04 백엔드 집계(쟁점 2). 목업: 최근 7일 등록 수
  const since = Date.now() - 7 * 86400_000;
  return store.nodes.filter((l) => l.workspace_id === wsId && Date.parse(l.created_at) >= since).length;
}

// get_chain(ws, entry, max_depth=3): 조상(음수 depth)·자손(양수 depth). 04 §3.3 의미와 동일
export async function getChain(wsId: number, entryId: number, maxDepth = 3): Promise<Chain | null> {
  await connection(); // Date.now() 기반 목업 상태 전이는 요청 시점에만 (Cache Components 프리렌더 제외)
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

// 목업 정제 워커: 읽는 시점에 경과 시간으로 상태 전이 (pending 1.5s → processing 3.5s → done)
function settle(n: StoreNode): LogNode {
  if (n.refine_status === "done" || n.refine_status === "failed" || !n.refine_started_at) return n;
  const t = Date.now() - n.refine_started_at;
  if (t < 1500) n.refine_status = "pending";
  else if (t < 3500) n.refine_status = "processing";
  else {
    n.refine_status = "done";
    const words = `${n.title} ${n.body}`.replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((w) => w.length >= 2);
    n.keywords = [...new Set(words)].slice(0, 5);
    n.resolution_summary = n.type === "success" ? `${n.title} — 조치 적용, 결과 확인됨` : n.type === "ref" ? `참고 자료: ${n.title}` : `증상: ${n.title}`;
    n.last_confirmed_at = n.type === "success" ? new Date().toISOString() : null;
  }
  return n;
}

// 소속 루트 계산: 첫 부모를 따라 올라감 (다중 부모도 같은 루트에 속한다는 가정)
function rootOf(id: number, seen = new Set<number>()): number {
  if (seen.has(id)) return id;
  seen.add(id);
  const e = store.edges.find((x) => x.child_id === id);
  return e ? rootOf(e.parent_id, seen) : id;
}
function withRoot(n: LogNode): LogNode {
  return { ...n, root_id: rootOf(n.id) };
}

export async function setResolved(wsId: number, id: number, resolved: boolean): Promise<LogNode | null> {
  const n = store.nodes.find((x) => x.id === id && x.workspace_id === wsId);
  if (!n) return null;
  if (rootOf(n.id) !== n.id) return null; // 루트만 완료 처리 가능
  n.resolved_at = resolved ? new Date().toISOString() : null;
  return withRoot(n);
}

export async function getLog(wsId: number, id: number): Promise<LogNode | null> {
  await connection(); // Date.now() 기반 목업 상태 전이는 요청 시점에만 (Cache Components 프리렌더 제외)
  const n = store.nodes.find((x) => x.id === id && x.workspace_id === wsId);
  return n ? withRoot(settle(n)) : null;
}

export async function refineLog(wsId: number, id: number): Promise<LogNode | null> {
  const n = store.nodes.find((x) => x.id === id && x.workspace_id === wsId);
  if (!n) return null;
  n.refine_status = "pending";
  n.refine_started_at = Date.now();
  n.keywords = [];
  n.resolution_summary = null;
  return withRoot(n);
}

// 폐기/복원. cascade=true면 "이 노드를 거치지 않고는 활성 조상에 닿을 수 없는" 자손도 함께 폐기한다 (다중 부모로 다른 활성 경로가 있으면 제외).
export async function setLogStatus(wsId: number, id: number, status: "active" | "deprecated", cascade = false): Promise<{ node: LogNode; affected: number[] } | null> {
  const n = store.nodes.find((x) => x.id === id && x.workspace_id === wsId);
  if (!n) return null;
  const affected: number[] = [];
  if (status === "deprecated") {
    n.status = "deprecated";
    n.deprecated_via = null;
    if (cascade) {
      for (const d of orphanedBy(id)) {
        const c = store.nodes.find((x) => x.id === d)!;
        if (c.status === "active") { c.status = "deprecated"; c.deprecated_via = id; affected.push(d); }
      }
    }
  } else {
    n.status = "active";
    n.deprecated_via = null;
    // 이 노드 폐기로 함께 폐기됐던 자손만 복원
    store.nodes.filter((x) => x.deprecated_via === id).forEach((c) => { c.status = "active"; c.deprecated_via = null; affected.push(c.id); });
  }
  return { node: withRoot(n), affected };
}

// id를 폐기했을 때 활성 조상 경로를 전부 잃는 자손 집합
export function orphanedBy(id: number): number[] {
  const children = (p: number) => store.edges.filter((e) => e.parent_id === p).map((e) => e.child_id);
  const parents = (c: number) => store.edges.filter((e) => e.child_id === c).map((e) => e.parent_id);
  const dead = new Set<number>([id]);
  const queue = [...children(id)];
  while (queue.length) {
    const c = queue.shift()!;
    if (dead.has(c)) continue;
    const node = store.nodes.find((x) => x.id === c);
    if (!node || node.status === "deprecated") continue;
    const hasLiveParent = parents(c).some((p) => !dead.has(p) && store.nodes.find((x) => x.id === p)?.status === "active");
    if (hasLiveParent) continue;
    dead.add(c);
    queue.push(...children(c));
  }
  dead.delete(id);
  return [...dead];
}

export async function createLog(
  wsId: number,
  input: { type: LogType; title: string; body: string; parent_id: number | null; author_name?: string; resolve_root?: boolean },
): Promise<LogNode> {
  const id = store.nextId++;
  const parent = input.parent_id ? store.nodes.find((n) => n.id === input.parent_id && n.workspace_id === wsId) : undefined;
  if (input.parent_id && !parent) throw new Error("PARENT_NOT_FOUND");
  if (parent?.status === "deprecated") throw new Error("PARENT_DEPRECATED");
  const node: StoreNode = {
    id,
    refine_started_at: Date.now(),
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
    deprecated_via: null,
    resolved_at: null,
    root_id: id,
    created_at: new Date().toISOString(),
  };
  store.nodes.push(node);
  if (parent) store.edges.push({ parent_id: parent.id, child_id: id });
  if (parent && input.resolve_root) {
    const r = store.nodes.find((x) => x.id === rootOf(parent.id));
    if (r) r.resolved_at = new Date().toISOString();
  }
  return withRoot(node);
}
