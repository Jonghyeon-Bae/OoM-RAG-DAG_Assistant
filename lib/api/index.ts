// 데이터 접근 단일 지점(서버). 지금은 메모리 목업, 3단계에서 Spring/Python 호출로 교체한다.
// 클라이언트 컴포넌트는 lib/api/client.ts 를 통해 app/api/mock/* 라우트를 호출한다.
import type { Workspace, User, LogNode, LogCounts, Chain, ChainNode, LogType, DashboardSummary, PolicyDocument, PolicyChunk, DocStatus, DocEvent, DocEventAction } from "@/lib/types/domain";
import chunksSeed from "@/mocks/chunks.json";
import workspaces from "@/mocks/workspaces.json";
import users from "@/mocks/users.json";
import { connection } from "next/server";
import { store, type StoreNode } from "@/lib/api/store";
import policySeed from "@/mocks/policy_chunks.json";
import type { PolicyRef, ChatEvent, Intent, Mode } from "@/lib/types/domain";

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

// 질문과 청크의 단어 겹침으로 점수. hybrid_search_chunks() 어휘 검색의 거친 흉내 (목업 전용)
export async function getPolicyChunks(wsId: number, query = ""): Promise<PolicyRef[]> {
  const all = (policySeed as (PolicyRef & { workspace_id: number })[]).filter((c) => c.workspace_id === wsId);
  const words = query.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((w) => w.length >= 2);
  if (!words.length) return all;
  return all
    .map((c) => {
      const hay = `${c.doc_title} ${c.article_label} ${c.text}`.toLowerCase();
      return { c, score: words.filter((w) => hay.includes(w)).length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x, i) => ({ ...x.c, ref: `P${i + 1}` }));   // 마커는 순위대로 다시 부여
}
export interface MockAnswer {
  query: string;
  policy: PolicyRef[];
  chain: Chain | null;
  policy_text: string | null;
  chain_text: string | null;
  verified: string[];
  unverified: string[];
  total_ms: number | null;
  chain_refs: { id: number; ref: string }[];
}

export async function getMockAnswer(wsId: number, query: string): Promise<MockAnswer> {
  const ws = await getWorkspace(wsId);
  const policy = ws?.policy_enabled ? await getPolicyChunks(wsId, query) : [];

  // hybrid_search_nodes 1단계(에러 코드 정확 일치)만 흉내. 워크스페이스 범위 엄수
  const code = /([A-Z]{1,4}-?\d{3,4}|HTTP\s?\d{3})/i.exec(query)?.[0]?.toUpperCase() ?? null;
  const entry = code
    ? store.nodes.find((n) => n.workspace_id === wsId && n.error_code?.toUpperCase() === code && n.type === "fail" && n.status === "active")
    : undefined;
  const chain = entry ? await getChain(wsId, entry.id) : null;

  // 마커: 규정 P1…, 체인 N1…(depth 순). Critic은 이 집합과 답변 속 마커를 대조한다
  const nodes = chain ? [...chain.nodes].sort((a, b) => a.depth - b.depth || a.id - b.id) : [];
  const nref = new Map(nodes.map((n, i) => [n.id, `N${i + 1}`]));
  const mark = (id: number) => `[${nref.get(id)}]`;

  const policy_text = policy.length
    ? policy.map((p) => `${p.text.split("②")[0].replace(/^①\s*/, "").trim()} [${p.ref}]`).join(" ")
    : null;

  const fails = nodes.filter((n) => n.type === "fail");
  const fixes = nodes.filter((n) => n.type === "success" && n.status === "active");
  const head = fails[0] ?? nodes[0];
  const chain_text = head
    ? [
        `${head.title} ${mark(head.id)}`,
        fails.length > 1 ? `은(는) ${fails.slice(1).map((n) => `${n.title} ${mark(n.id)}`).join(", ")}이 원인으로 등록되어 있으며,` : "에 대해",
        fixes.length ? `${fixes.map((n) => `${n.title} ${mark(n.id)}`).join(", ")}로 해소되었습니다.` : "아직 확인된 해결 로그가 없습니다.",
      ].join(" ")
    : null;

  const used = [...new Set([...`${policy_text ?? ""} ${chain_text ?? ""}`.matchAll(/\[([PN]\d+)\]/g)].map((m) => m[1]))];
  const known = new Set([...policy.map((p) => p.ref), ...nref.values()]);

  return {
    query,
    policy,
    chain,
    policy_text,
    chain_text,
    verified: used.filter((r) => known.has(r)),
    unverified: used.filter((r) => !known.has(r)),
    total_ms: null, // 목업엔 생성 시간이 없다. 실제는 done.latency.total_ms
    chain_refs: nodes.map((n) => ({ id: n.id, ref: nref.get(n.id)! })), 
  };
}

// ── 어시스턴트 목업 SSE 이벤트 생성기 (04 §4.3 9종). 라우트는 이걸 그대로 흘려보내기만 한다.
// 실제: Spring 이 session 송출, Python LangGraph 가 나머지 송출, Spring 이 done 을 가로채 세션 기록.
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let mockSession = 1000;

export async function* mockChatEvents(wsId: number, query: string): AsyncGenerator<ChatEvent> {
  const t0 = Date.now();
  const ws = await getWorkspace(wsId);
  const mode: Mode = ws?.policy_enabled ? "policy" : "dag_only";

  yield { event: "session", data: { session_id: ++mockSession } };

  // supervisor — DAG 단일은 분류 생략, 규정 결합은 LLM 분류 1회 흉내
  yield { event: "stage", data: { node: "supervisor", status: "start" } };
  if (mode === "policy") await sleep(300);
  const a = await getMockAnswer(wsId, query);
  const intent: Intent =
    mode === "dag_only" ? "troubleshoot" : a.policy.length && a.chain ? "both" : a.policy.length ? "policy" : a.chain ? "troubleshoot" : "both";
  yield { event: "stage", data: { node: "supervisor", status: "done", detail: mode === "dag_only" ? "분류 생략" : undefined } };
  yield { event: "intent", data: { intent, mode } };

  // Worker A ∥ B — 검색 결과를 생성 전에 선송출
  if (mode === "policy" && intent !== "troubleshoot") {
    yield { event: "stage", data: { node: "policy_rag", status: "start" } };
    await sleep(250);
    if (a.policy.length) yield { event: "policy", data: a.policy };
    yield { event: "stage", data: { node: "policy_rag", status: "done" } };
  }
  if (intent !== "policy") {
    yield { event: "stage", data: { node: "graph_search", status: "start" } };
    await sleep(250);
    if (a.chain) {
      const ref = new Map(a.chain_refs.map((r) => [r.id, r.ref]));
      yield {
        event: "chain",
        data: {
          entry_id: a.chain.entry_id,
          edges: a.chain.edges,
          nodes: a.chain.nodes.map((n) => ({
            ref: ref.get(n.id)!, id: n.id, type: n.type, status: n.status, title: n.title,
            depth: n.depth, path_label: n.path_label, last_confirmed_at: n.last_confirmed_at,
          })),
        },
      };
    }
    yield { event: "stage", data: { node: "graph_search", status: "done" } };
  }
  const retrieval_ms = Date.now() - t0;

  // gate — 0건이면 LLM 미호출
  yield { event: "stage", data: { node: "gate", status: "start" } };
  const hasContext = a.policy.length > 0 || !!a.chain;
  yield { event: "stage", data: { node: "gate", status: "done", detail: hasContext ? undefined : "근거 없음" } };

  const text = hasContext
    ? [a.policy_text && `## 규정 근거\n${a.policy_text}`, a.chain_text && `## 유사 장애 해결 사례 (DAG 체인)\n${a.chain_text}`].filter(Boolean).join("\n\n")
    : "등록된 규정이나 과거 해결 사례에서 이 질문의 근거를 찾지 못했습니다. 질문을 바꾸거나 관련 로그를 먼저 등록해 주세요.";

  // generate — 토큰 스트리밍 흉내
  let first_token_ms = 0;
  if (hasContext) yield { event: "stage", data: { node: "generate", status: "start" } };
  for (let i = 0; i < text.length; i += 4) {
    if (!first_token_ms) first_token_ms = Date.now() - t0;
    yield { event: "token", data: { text: text.slice(i, i + 4) } };
    await sleep(15);
  }
  if (hasContext) yield { event: "stage", data: { node: "generate", status: "done" } };

  // critic — LLM 미사용, 마커 대조 (getMockAnswer 가 이미 계산)
  if (hasContext) {
    yield { event: "stage", data: { node: "critic", status: "start" } };
    yield { event: "citations", data: { verified: a.verified, unverified: a.unverified } };
    yield { event: "stage", data: { node: "critic", status: "done" } };
  } else {
    yield { event: "citations", data: { verified: [], unverified: [] } };
  }

  // done — Spring 이 가로채 search_sessions UPDATE
  const refToId = new Map<string, string>([
    ...a.policy.map((p) => [p.ref, p.chunk_id] as const),
    ...a.chain_refs.map((r) => [r.ref, String(r.id)] as const),
  ]);
  yield {
    event: "done",
    data: {
      intent,
      retrieved_ids: [...refToId.values()],
      verified_ids: a.verified.map((r) => refToId.get(r)!),
      unverified_ids: a.unverified,
      latency: { retrieval_ms, first_token_ms, total_ms: Date.now() - t0 },
      model: "mock", prompt_tokens: 0, completion_tokens: Math.ceil(text.length / 2),
    },
  };
}

// 대시보드 요약 — 로그 집계는 저장소 실시간, 탐색 시간·평가는 실측 전 예시값(is_sample)
export async function getDashboardSummary(wsId: number): Promise<DashboardSummary> {
  await connection();
  const all = store.nodes.filter((l) => l.workspace_id === wsId).map(settle).map(withRoot);
  const roots = all.filter((l) => l.id === l.root_id);
  const since = Date.now() - 7 * 86400_000;
  return {
    is_sample: true,
    search_time: {
      before_min: 5.5,
      after_min: 1.4,
      by_intent: [
        { intent: "policy", before_min: 3.8, after_min: 0.9 },
        { intent: "troubleshoot", before_min: 5.6, after_min: 1.5 },
        { intent: "both", before_min: 7.2, after_min: 1.8 },
      ],
    },
    eval: { faithfulness: 0.94, answer_relevance: 0.91, dataset_version: "sample", run_at: null },
    logs: {
      total: all.length,
      week: all.filter((l) => Date.parse(l.created_at) >= since).length,
      open_roots: roots.filter((r) => !r.resolved_at && r.status === "active").length,
      resolved_roots: roots.filter((r) => !!r.resolved_at).length,
      refine_failed: all.filter((l) => l.refine_status === "failed").length,
    },
    feedback: { up: 0, down: 0 },
    latency_ms: { retrieval: null, first_token: null, total: null },
  };
}

// ---- 규정 문서 (Spring 소유: status·삭제. 인덱싱은 Python 스크립트)
export async function getDocuments(wsId: number): Promise<PolicyDocument[]> {
  return store.docs.filter((d) => d.workspace_id === wsId).sort((a, b) => a.title.localeCompare(b.title) || b.indexed_at.localeCompare(a.indexed_at));
}

function logDocEvent(d: PolicyDocument, action: DocEventAction, actor: string, reason: string | null) {
  store.docEvents.push({ id: store.docEvents.length + 1, workspace_id: d.workspace_id, document_id: d.id, document_label: `${d.title} ${d.version}`, action, actor, source: "ui", reason, at: new Date().toISOString() });
}

export async function setDocumentStatus(wsId: number, id: number, status: DocStatus, actor: string, reason?: string): Promise<PolicyDocument | null> {
  const d = store.docs.find((x) => x.id === id && x.workspace_id === wsId);
  if (!d) return null;
  d.status = status;
  d.retired_at = status === "retired" ? new Date().toISOString() : null;
  d.retire_reason = status === "retired" ? (reason ?? null) : null;
  d.retired_by = status === "retired" ? actor : null;
  logDocEvent(d, status === "retired" ? "retired" : "restored", actor, reason ?? null);
  return d;
}

// 삭제는 retired 상태에서만. 청크·파일은 서버가 함께 제거(CASCADE). 실행자는 purge_document() (ARCH-003 #2)
export async function deleteDocument(wsId: number, id: number, actor: string): Promise<"ok" | "not_found" | "not_retired"> {
  const i = store.docs.findIndex((x) => x.id === id && x.workspace_id === wsId);
  if (i < 0) return "not_found";
  if (store.docs[i].status !== "retired") return "not_retired";
  logDocEvent(store.docs[i], "deleted", actor, null);
  store.docs.splice(i, 1);
  return "ok";
}

export async function getDocumentChunks(wsId: number, id: number): Promise<PolicyChunk[] | null> {
  const d = store.docs.find((x) => x.id === id && x.workspace_id === wsId);
  if (!d) return null;
  const all = chunksSeed as Record<string, PolicyChunk[]>;
  return all[d.slug] ?? [];
}

// 이력. document_id 없으면 워크스페이스 전체(삭제된 문서 포함). 실서버: audit_log(S8) 읽기
export async function getDocumentEvents(wsId: number, documentId?: number, limit = 30): Promise<DocEvent[]> {
  return store.docEvents
    .filter((e) => e.workspace_id === wsId && (!documentId || e.document_id === documentId))
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
