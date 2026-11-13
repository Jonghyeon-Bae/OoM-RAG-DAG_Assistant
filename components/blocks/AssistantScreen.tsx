"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, ChevronDown, Loader2, Square, ExternalLink, RotateCcw, History, X, CircleCheck, TriangleAlert, CircleMinus, Check, Info, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import { ChainBlock } from "@/components/blocks/ChainBlock";
import { SourceViewer } from "@/components/blocks/SourceViewer";
import { fetchSessions, patchSessionScore, streamChat } from "@/lib/api/client";
import { modeOf, type WsMode } from "@/lib/mode";
import type { Chain, ChainEvent, ChatEvent, CitationsEvent, DoneEvent, Intent, Mode, PolicyRef, SearchSession, StageNode, StageStatus, Workspace } from "@/lib/types/domain";
import { shortArticle } from "@/lib/article";

// ── 한 질의(턴)의 상태: SSE 이벤트 9종이 차례로 채운다. 실서버에서는 턴 1개 = search_sessions 1행 ──
type Status = "idle" | "streaming" | "done" | "error";
interface Turn {
  status: Status;
  query: string;
  askedAt: string;
  sessionId: number | null;
  stages: Partial<Record<StageNode, { status: StageStatus; detail?: string }>>;
  intent: Intent | null;
  mode: Mode | null;
  policy: PolicyRef[];
  chain: ChainEvent | null;
  text: string;
  citations: CitationsEvent | null;
  done: DoneEvent | null;
  error: string | null;
  vote: 1 | -1 | null; // 도움 여부 → PATCH /sessions/{id} (실서버 POST /api/feedback)
  fromHistory?: boolean; // 검색 내역에서 다시 연 턴
}
const blank = (query = ""): Turn => ({ status: "idle", query, askedAt: new Date().toISOString(), sessionId: null, stages: {}, intent: null, mode: null, policy: [], chain: null, text: "", citations: null, done: null, error: null, vote: null });

// 화면 세션: 이 워크스페이스에서 주고받은 턴 목록. 현재 턴이 마지막 원소
interface ChatState { turns: Turn[] }
type Action =
  | { type: "start"; query: string }
  | { type: "event"; e: ChatEvent }
  | { type: "fail"; message: string }
  | { type: "stop" }
  | { type: "vote"; index: number; vote: 1 | -1 | null }
  | { type: "restore"; turns: Turn[] }
  | { type: "reopen"; turn: Turn }
  | { type: "clear" };

function applyEvent(t: Turn, e: ChatEvent): Turn {
  switch (e.event) {
    case "session":   return { ...t, sessionId: e.data.session_id };
    case "stage":     return { ...t, stages: { ...t.stages, [e.data.node]: { status: e.data.status, detail: e.data.detail } } };
    case "intent":    return { ...t, intent: e.data.intent, mode: e.data.mode };
    case "policy":    return { ...t, policy: e.data };
    case "chain":     return { ...t, chain: e.data };
    case "token":     return { ...t, text: t.text + e.data.text };
    case "citations": return { ...t, citations: e.data };
    case "done":      return { ...t, status: "done", done: e.data };
    case "error":     return { ...t, status: "error", error: e.data.message };
  }
}
function reducer(s: ChatState, a: Action): ChatState {
  const last = s.turns.length - 1;
  const patchLast = (f: (t: Turn) => Turn) => ({ turns: s.turns.map((t, i) => (i === last ? f(t) : t)) });
  switch (a.type) {
    case "start":   return { turns: [...s.turns, { ...blank(a.query), status: "streaming" }] };
    case "event":   return patchLast((t) => applyEvent(t, a.e));
    case "fail":    return patchLast((t) => ({ ...t, status: "error", error: a.message }));
    case "stop":    return patchLast((t) => (t.status === "streaming" ? { ...t, status: "done" } : t));
    case "vote":    return { turns: s.turns.map((t, i) => (i === a.index ? { ...t, vote: a.vote } : t)) };
    case "restore": return { turns: a.turns };
    case "reopen":  return { turns: [...s.turns, a.turn] };
    case "clear":   return { turns: [] };
  }
}

// 검색 내역(서버 저장분) → 화면 턴. 재검색 없이 저장된 답을 그대로 보여준다
const turnFromSession = (x: SearchSession): Turn => ({
  status: x.status === "done" ? "done" : "error", 
  query: x.query, 
  askedAt: x.created_at, 
  sessionId: x.id, stages: {}, 
  intent: x.intent, 
  mode: x.mode,
  policy: x.policy, 
  chain: x.chain, 
  text: x.answer_text, 
  citations: x.citations,
  done: x.status === "done" ? { intent: x.intent, retrieved_ids: [], verified_ids: [], unverified_ids: [], 
  latency: x.latency, model: "", prompt_tokens: 0, completion_tokens: 0 } : null,
  error: x.status === "streaming" ? "답변이 끝나기 전에 중단된 질문입니다. 다시 물어보면 새로 답합니다" : x.status === "error" ? "답변 중 오류가 난 질문입니다" : null,
  vote: x.score, fromHistory: true,
});

// ── 화면 라벨 (사용자 언어 — UX-001) ─────────────────────────────────────────
const stageLabel: { node: StageNode; label: string; hint: string }[] = [
  { node: "supervisor", label: "질문 분석", hint: "규정 질문인지 장애 해결 질문인지 가립니다" },
  { node: "policy_rag", label: "규정 검색", hint: "규정 문서에서 관련 조항을 찾습니다" },
  { node: "graph_search", label: "해결 사례 검색", hint: "등록된 장애 건에서 비슷한 흐름을 찾습니다" },
  { node: "gate", label: "근거 확인", hint: "찾은 근거가 충분한지 봅니다. 없으면 답을 지어내지 않습니다" },
  { node: "generate", label: "답변 작성", hint: "찾은 근거만으로 답을 씁니다" },
  { node: "critic", label: "출처 검증", hint: "답변 속 번호가 실제 근거와 맞는지 대조합니다" },
];
const intentLabel: Record<Intent, string> = { policy: "규정 확인", troubleshoot: "장애 해결", both: "규정 + 해결 사례" };
// 실서버 stage detail 코드 → 표시 문구 (근거 없음은 gate 의 detail "no_evidence")
const detailLabel: Record<string, string> = { no_evidence: "근거 없음" };
// 추천 질문은 서버 workspace.suggestions(부서별). 고정 문구는 그 부서에 근거가 없는 질문을 띄운다 (FE-012 P0-2)
// 모드별 안내·입력 힌트 (lib/mode 의 모드 3종)
const modeIntro: Record<WsMode, string> = {
  both: "규정 근거와 과거 장애 해결 사례를 한 번에 물어보세요.",
  policy: "이 워크스페이스는 규정만 검색합니다. 규정·절차를 물어보세요.",
  case: "이 워크스페이스는 해결 사례만 검색합니다. 겪고 있는 오류나 증상을 물어보세요.",
};
const modeHint: Record<WsMode, string> = {
  both: "규정이나 과거 장애 해결 사례를 물어보세요",
  policy: "규정·절차를 물어보세요",
  case: "겪고 있는 오류나 증상을 적어 보세요",
};
// SSE chain 이벤트 → REST Chain 모양(ChainBlock 공용). SSE NodePolicy 는 RefView 의 축약형이라 표시 필드만 옮긴다
const chainFromEvent = (e: ChainEvent): Chain => ({
  entry_id: e.entry_id, edges: e.edges.map((x) => ({ ...x, reason: x.reason ?? null })), summary: null, total: e.nodes.length, truncated: false,
  nodes: e.nodes.map((n) => ({
    id: n.id, type: n.type, status: n.status, title: n.title, depth: n.depth, path_label: n.path_label ?? "", note: null, last_confirmed_at: n.last_confirmed_at,
    resolves_root: !!n.resolves_root, is_cause: !!n.is_cause,
    policy_refs: (n.policy ?? []).map((p) => ({ relation: p.relation, policy: null, article: null, note: p.note ?? null, topic: p.topic ?? null, doc_title: null, article_label: p.label ?? null, revision: p.revision ?? null, from_label: p.from_version ?? null })),
  })),
});
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });

export function AssistantScreen({ ws }: { ws: Workspace }) {
  const [state, dispatch] = useReducer(reducer, { turns: [] });
  const [input, setInput] = useState("");
  const [activeRef, setActiveRef] = useState<string | null>(null);
  const [activeNode, setActiveNode] = useState<number | null>(null);
  const [sourceTurn, setSourceTurn] = useState<number | null>(null); // 규정 원문 패널이 보여줄 턴. null = 마지막 턴
  const [history, setHistory] = useState<{ open: boolean; items: SearchSession[]; loading: boolean }>({ open: false, items: [], loading: false });
  const ctrl = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const srcRef = useRef<HTMLDivElement>(null); // 1열(~1023): 규정 마커를 누르면 아래 원문 패널로 이동
  const endRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true); // 사용자가 위로 올려 읽는 중이면 자동 스크롤을 멈춘다
  const policyMode = ws.policy_enabled; // 규정 원문 패널 유무
  const mode = modeOf(ws);
  const current = state.turns[state.turns.length - 1];
  const streaming = current?.status === "streaming";
  const storageKey = `oom.chat.${ws.id}`;

  // 화면 세션 복원/저장: 타임라인으로 갔다 와도 대화가 남는다. 브라우저 탭 단위(sessionStorage). 실서버는 search_sessions 조회로 대체
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const turns = (JSON.parse(raw) as Turn[]).map((t) => (t.status === "streaming" ? { ...t, status: "error" as const, error: "이전 세션에서 중단됨" } : t));
        dispatch({ type: "restore", turns });
      }
    } catch { /* 저장소 불가 환경 */ }
  }, [storageKey]);
  const restored = useRef(false);
  useEffect(() => {
    // 복원 전에 빈 배열로 덮어쓰지 않도록, 첫 저장은 복원 effect가 끝난 뒤부터
    if (!restored.current) { restored.current = true; return; }
    try { sessionStorage.setItem(storageKey, JSON.stringify(state.turns.slice(-20))); } catch { /* ignore */ }
  }, [state.turns, storageKey]);
  // 자동 스크롤: 새 턴은 항상, 토큰 추가는 바닥 근처에 있을 때만 최신 답으로 따라간다
  const scrollToEnd = (behavior: ScrollBehavior = "smooth") => endRef.current?.scrollIntoView({ block: "end", behavior });
  // 검색 내역에서 다시 연 답은 끝이 아니라 그 질문부터 보여 준다 — 바닥으로 내리면 질문·상단 줄이 헤더 뒤로 가려졌다(#104)
  const turnRefs = useRef(new Map<number, HTMLDivElement>());
  // 검색 내역은 대화 맨 위에 열린다 — 바닥을 보고 있으면 연 줄도 모르므로 그 자리로 올린다(#105)
  const historyRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (history.open) historyRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }); }, [history.open]);
  const focusTurn = useRef<number | null>(null);
  const scrollToTurn = (i: number) => turnRefs.current.get(i)?.scrollIntoView({ block: "start", behavior: "smooth" });
  useEffect(() => {
    if (focusTurn.current !== null) {
      const i = focusTurn.current;
      focusTurn.current = null;
      stickToBottom.current = false;
      scrollToTurn(i);
      return;
    }
    stickToBottom.current = true;
    scrollToEnd("auto");
  }, [state.turns.length]);
  useEffect(() => { if (stickToBottom.current) scrollToEnd(); }, [current?.text.length, current?.status]);
  const onListScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const overflowing = el.scrollHeight > el.clientHeight + 4;
    stickToBottom.current = overflowing ? el.scrollHeight - el.scrollTop - el.clientHeight < 120 : window.innerHeight + window.scrollY >= document.body.scrollHeight - 120;
  };
  useEffect(() => {
    const onWin = () => { if (listRef.current && listRef.current.scrollHeight <= listRef.current.clientHeight + 4) onListScroll(); };
    window.addEventListener("scroll", onWin, { passive: true });
    return () => window.removeEventListener("scroll", onWin);
  }, []);

  const stop = () => { ctrl.current?.abort(); ctrl.current = null; dispatch({ type: "stop" }); };

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query || streaming) return;
    ctrl.current?.abort();
    const ac = new AbortController();
    ctrl.current = ac;
    setInput("");
    setActiveRef(null);
    setActiveNode(null);
    setSourceTurn(null);
    dispatch({ type: "start", query });
    try {
      await streamChat(ws.id, query, (e) => {
        dispatch({ type: "event", e });
        if (e.event === "policy" && e.data.length) setActiveRef((cur) => cur ?? e.data[0].ref); // 첫 출처 자동 선택
      }, ac.signal);
    } catch (err) {
      if ((err as Error).name !== "AbortError") dispatch({ type: "fail", message: err instanceof Error ? err.message : "연결이 끊겼습니다" });
    } finally {
      if (ctrl.current === ac) ctrl.current = null;
    }
  };

  // 검색 내역: 서버에 저장된 이 워크스페이스의 질문들. 열 때마다 새로 받는다
  const toggleHistory = async () => {
    if (history.open) { setHistory((h) => ({ ...h, open: false })); return; }
    setHistory((h) => ({ ...h, open: true, loading: true }));
    const items = await fetchSessions(ws.id, 30);
    setHistory({ open: true, items, loading: false });
  };
  const reopen = (x: SearchSession) => {
    setHistory((h) => ({ ...h, open: false }));
    const idx = state.turns.findIndex((t) => t.sessionId === x.id);
    if (idx >= 0) { setSourceTurn(idx === state.turns.length - 1 ? null : idx); setActiveRef(x.policy[0]?.ref ?? null); scrollToTurn(idx); return; }
    focusTurn.current = state.turns.length;
    dispatch({ type: "reopen", turn: turnFromSession(x) });
    setSourceTurn(null);
    setActiveRef(x.policy[0]?.ref ?? null);
  };
  const vote = async (index: number, v: 1 | -1 | null) => {
    dispatch({ type: "vote", index, vote: v });
    const sid = state.turns[index]?.sessionId;
    if (sid) await patchSessionScore(ws.id, sid, v);
  };

  // 마커 클릭: P → 그 턴의 규정 원문, N → 해결 흐름 카드 강조. 이전 턴의 근거도 다시 볼 수 있다
  const cite = (index: number, turn: Turn, ref: string) => {
    setSourceTurn(index === state.turns.length - 1 ? null : index);
    if (ref.startsWith("P")) {
      setActiveRef(ref);
      if (window.matchMedia("(max-width: 1023px)").matches) setTimeout(() => srcRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
      return;
    }
    const node = turn.chain?.nodes.find((n) => n.ref === ref);
    if (node) setActiveNode(node.id);
  };
  const sourceIndex = sourceTurn ?? state.turns.length - 1;
  const sourceOf = state.turns[sourceIndex];
  const shownRef = activeRef ?? sourceOf?.policy[0]?.ref ?? null; // 패널이 실제로 보여 주는 근거 번호 (고른 게 없으면 첫 근거)

  return (
    <main className={cn("grid flex-1 items-start gap-4 p-3 sm:gap-6 md:p-6 xl:p-8", policyMode ? "lg:grid-cols-[minmax(0,1fr)_320px] xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1")}>
      <section className={cn("flex min-w-0 flex-col lg:h-[calc(100dvh-8rem)] xl:h-[calc(100dvh-9rem)]", !policyMode && "mx-auto w-full max-w-4xl")}>
        {/* [&>*]:shrink-0 — 높이가 고정된 스크롤 칸 안의 flex 자식은 줄어든다. 검색 내역 카드가 32px로 눌려 답변 뒤에 가려졌다(D-014, #105) */}
        <div ref={listRef} onScroll={onListScroll} className="flex flex-1 flex-col gap-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1 [&>*]:shrink-0">
          {state.turns.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-sm text-ink-muted">
              <p className="font-medium text-ink">{modeIntro[mode]}</p>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {ws.suggestions.map((q) => (
                  <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-ink hover:bg-primary-50 pointer-coarse:px-4 pointer-coarse:py-2.5 pointer-coarse:text-sm">{q}</button>
                ))}
              </div>
              <button type="button" onClick={toggleHistory} className="mt-2 inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-ink hover:bg-primary-50"><History className="size-3" /> 이전에 물어본 것 보기</button>
              {history.open && <div className="w-full max-w-xl text-left"><HistoryPanel history={history} onPick={reopen} onClose={() => setHistory((h) => ({ ...h, open: false }))} /></div>}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
                <span>이 화면의 질문 {state.turns.length}건</span>
                <span className="flex items-center gap-3">
                  <button type="button" onClick={toggleHistory} className="inline-flex items-center gap-1 hover:text-ink"><History className="size-3" /> 검색 내역</button>
                  <button type="button" onClick={() => { stop(); dispatch({ type: "clear" }); }} title="화면만 비웁니다. 검색 내역은 남습니다" className="inline-flex items-center gap-1 hover:text-ink"><RotateCcw className="size-3" /> 화면 비우기</button>
                </span>
              </div>
              {history.open && <div ref={historyRef} className="scroll-mt-20 lg:scroll-mt-2"><HistoryPanel history={history} onPick={reopen} onClose={() => setHistory((h) => ({ ...h, open: false }))} /></div>}
              {state.turns.map((t, i) => {
                const isLast = i === state.turns.length - 1;
                return (
                  <div key={`${t.askedAt}-${i}`} ref={(el) => { if (el) turnRefs.current.set(i, el); else turnRefs.current.delete(i); }} className="flex scroll-mt-20 flex-col gap-3 lg:scroll-mt-2">
                    <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-ink px-4 py-3 text-sm sm:px-5 leading-relaxed text-white sm:max-w-[62%]">
                      {t.query}
                      <span className="mt-1 block text-right text-xs text-white/60">{fmtTime(t.askedAt)}</span>
                    </div>
                    {isLast && <PipelineBadges turn={t} />}
                    <AnswerCard key={`${t.askedAt}-${isLast ? "open" : "folded"}`} turn={t} wsId={ws.id} collapsed={!isLast} highlighted={sourceIndex === i && state.turns.length > 1} activeNode={sourceIndex === i ? activeNode : null} activeRef={sourceIndex === i ? shownRef : null} onOpen={() => { setSourceTurn(isLast ? null : i); setActiveRef(t.policy[0]?.ref ?? null); }} onCite={(ref) => cite(i, t, ref)} onVote={(v) => vote(i, v)} onRetry={isLast && !streaming ? () => ask(t.query) : undefined} />
                  </div>
                );
              })}
              <div ref={endRef} />
            </>
          )}
        </div>

        <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 mt-4 bg-background pb-2 pt-2 lg:static">
          <form className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 pl-5 shadow-sm" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={modeHint[mode]} className="h-11 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"/>
            {streaming ? (
              <Button type="button" variant="outline" size="lg" className="size-11 rounded-full p-0" onClick={stop} aria-label="중지"><Square className="size-4" /></Button>
            ) : (
              <Button type="submit" size="lg" className="size-11 rounded-full p-0" disabled={!input.trim()} aria-label="질문 보내기"><ArrowUp className="size-5" /></Button>
            )}
          </form>
        </div>
      </section>

      {policyMode && (
        <div ref={srcRef} className={cn("min-w-0 scroll-mt-16 lg:contents", !sourceOf?.policy?.length && "max-lg:hidden")}>{/* 1열에서는 인용된 조항이 있을 때만 */}
        <SourceViewer
          sources={sourceOf?.policy ?? []}
          activeRef={activeRef}
          onSelect={setActiveRef}
          current={!!sourceOf && !sourceOf.fromHistory && sourceOf.status === "done"}
          context={sourceOf ? { query: sourceOf.query, onBack: sourceTurn !== null ? () => { setSourceTurn(null); setActiveRef(current?.policy[0]?.ref ?? null); } : undefined } : undefined}
        />
        </div>
      )}
    </main>
  );
}

// ── 검색 내역 패널: 서버 저장분. 누르면 저장된 답을 그대로 다시 연다(재검색 없음) ──
function HistoryPanel({ history, onPick, onClose }: { history: { items: SearchSession[]; loading: boolean }; onPick: (x: SearchSession) => void; onClose: () => void }) {
  return (
    <Card className="shrink-0 gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">검색 내역 <span className="font-normal text-ink-muted">이 워크스페이스에서 물어본 질문. 누르면 그때 답을 다시 봅니다</span></span>
        <button type="button" onClick={onClose} aria-label="닫기" className="rounded p-1 text-ink-muted hover:bg-primary-100"><X className="size-4" /></button>
      </div>
      {history.loading ? <p className="text-xs text-ink-muted">불러오는 중…</p> : history.items.length === 0 ? <p className="text-xs text-ink-muted">아직 기록이 없습니다.</p> : (
        <ol className="max-h-80 divide-y divide-border overflow-y-auto">
          {history.items.map((x) => (
            <li key={x.id}>
              {/* 질문이 주인공: 1줄째 질문(최대 2줄), 2줄째 메타 — 열 고정 폭 때문에 질문이 "사후분…"으로 잘리던 것(#104) */}
              <button type="button" onClick={() => onPick(x)} className="flex w-full flex-col gap-1 px-1 py-2.5 text-left hover:bg-primary-50">
                <span className="line-clamp-2 text-sm text-ink">{x.query}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                  <span className="tabular-nums">{new Date(x.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                  <Chip className="h-5 text-xs">{intentLabel[x.intent]}</Chip>
                  {x.status !== "done" && <Chip tone={x.status === "error" ? "fail" : "warn"} className="h-5 text-xs">{x.status === "error" ? "중단됨" : "진행 중"}</Chip>}
                  <span>근거 {x.citations?.verified.length ?? 0}</span>
                  {x.score === 1 ? <span>👍</span> : x.score === -1 ? <span>👎</span> : null}
                  <span className="ml-auto">{x.user_name}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

// ── 진행 단계: stage 이벤트로 켜진다. 해결 사례만 쓰는 워크스페이스에선 규정 검색이 아예 안 뜬다 ──
function PipelineBadges({ turn }: { turn: Turn }) {
  const always: StageNode[] = ["supervisor", "gate", "generate", "critic"];
  const shown = stageLabel.filter(({ node }) => turn.stages[node] || (turn.status === "streaming" && always.includes(node)));
  if (!shown.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs">
      {shown.map(({ node, label, hint }, i) => {
        const st = turn.stages[node];
        return (
          <span key={node} className="flex items-center gap-1.5">
            {i > 0 && <ArrowRight className="size-3.5 text-ink-muted" />}
            <Chip title={hint} tone={st?.status === "error" ? "fail" : st?.status === "done" ? "primary" : st?.status === "start" ? "warn" : "neutral"} className={cn(!st && "opacity-40")}>
              {st?.status === "start" && <Loader2 className="mr-1 size-3 animate-spin" />}
              {label}{st?.detail ? ` · ${detailLabel[st.detail] ?? st.detail}` : ""}
            </Chip>
          </span>
        );
      })}
      {turn.intent && <Chip tone="dark" title="질문 분석 결과">{intentLabel[turn.intent]}</Chip>}
    </div>
  );
}
// ── 근거 확인 표시: 서버가 준 값만으로 세 단계. 점수가 아니라 확인된 사실의 요약 ──
// 주의: 서버의 인용 검증은 "번호가 실제 근거 목록에 있는가"까지다. 문장 내용이 조문과 맞는지는 보지 않는다
type TrustLevel = "ok" | "check" | "none";
const trustLabel: Record<TrustLevel, string> = { ok: "근거 확인됨", check: "확인 필요", none: "근거 없음" };
const trustTone: Record<TrustLevel, string> = { ok: "bg-success text-white", check: "bg-warn text-white", none: "bg-ref text-white" }; // 진한 바탕 + 흰 글씨
const trustSoft: Record<TrustLevel, string> = { ok: "border-success/30 bg-success-bg", check: "border-warn/30 bg-warn-bg", none: "border-ref/30 bg-ref-bg" }; // 이유 상자 테두리·바탕
const trustIcon: Record<TrustLevel, LucideIcon> = { ok: CircleCheck, check: TriangleAlert, none: CircleMinus }; // 색을 못 봐도 모양으로 구분
function trustOf(turn: Turn): { level: TrustLevel; reasons: { ok: boolean; text: string }[] } {
  const verified = turn.citations?.verified ?? [];
  const unverified = turn.citations?.unverified ?? [];
  if (verified.length === 0) return { level: "none", reasons: [{ ok: false, text: "답변에 확인된 근거 번호가 없습니다" }] };
  const cited = (turn.chain?.nodes ?? []).filter((n) => verified.includes(n.ref));
  const reasons = [
    { ok: true, text: `인용한 근거 ${verified.length}건이 찾은 근거 목록과 일치` },
    ...(unverified.length ? [{ ok: false, text: `근거 목록에 없는 번호 ${unverified.length}건` }] : []),
    ...(turn.done?.truncated ? [{ ok: false, text: "답변이 길어 중간에 잘렸습니다" }] : []),
    ...cited.filter((n) => n.status === "deprecated").map((n) => ({ ok: false, text: `기록 ${n.ref.slice(1)}: 폐기된 기록입니다` })),
    ...cited.filter((n) => (n.policy ?? []).some((p) => p.revision)).map((n) => ({ ok: false, text: `기록 ${n.ref.slice(1)}: 개정 전 규정을 따른 사례입니다` })),
    ...(turn.fromHistory ? [{ ok: false, text: "예전에 받은 답변입니다. 그 뒤 규정이 바뀌었는지는 확인하지 않았습니다" }] : []),
  ];
  return { level: reasons.some((r) => !r.ok) ? "check" : "ok", reasons };
}

// ── 답변 카드 ───────────────────────────────────────────────────────────────
function AnswerCard({ turn, wsId, collapsed, highlighted, activeNode, activeRef, onOpen, onCite, onVote, onRetry }: { turn: Turn; wsId: number; collapsed: boolean; highlighted: boolean; activeNode: number | null; activeRef: string | null; onOpen: () => void; onCite: (ref: string) => void; onVote: (v: 1 | -1 | null) => void; onRetry?: () => void }) {
  const [open, setOpen] = useState(!collapsed);
  const [why, setWhy] = useState(false); // 근거 확인 표시의 이유 펼침
  const trust = trustOf(turn);
  const TrustIcon = trustIcon[trust.level];
  const c = turn.citations;
  const tone = (ref: string) => (!c ? "neutral" : c.verified.includes(ref) ? "primary" : c.unverified.includes(ref) ? "warn" : "neutral");
  const chain: Chain | null = turn.chain ? chainFromEvent(turn.chain) : null;
  // 마커 설명: [P1] → 규정 조항, [N1] → 해결 흐름의 기록. 툴팁에 실제 제목을 보여준다
  const describe = (ref: string) => {
    if (ref.startsWith("P")) { const p = turn.policy.find((x) => x.ref === ref); return p ? `규정 ${ref.slice(1)}: ${p.doc_title} ${p.version} ${p.article_label}` : `규정 조항 ${ref.slice(1)}`; }
    const n = turn.chain?.nodes.find((x) => x.ref === ref);
    return n ? `해결 흐름 기록 ${ref.slice(1)}: ${n.title}` : `해결 흐름 기록 ${ref.slice(1)}`;
  };
  const hasP = /\[P\d+\]/.test(turn.text);
  const hasN = /\[N\d+\]/.test(turn.text);

  // 토큰 텍스트 → 줄 단위. "## " 는 섹션 제목, [P1]·[N1] 마커는 칩 (citations 도착 전엔 중립색)
  const render = (text: string) =>
    text.split("\n").map((line, i) => {
      if (line.startsWith("## ")) return <h3 key={i} className="mb-1 mt-3 text-sm font-bold text-primary-700 first:mt-0">{line.slice(3)}</h3>;
      if (!line.trim()) return null;
      return (
        <p key={i} className="text-sm leading-relaxed text-ink">
          {line.split(/(\[[PN]\d+\])/g).map((seg, j, segs) => {
            const m = /^\[([PN]\d+)\]$/.exec(seg);
            if (!m) return <span key={j} className={cn(segs[j + 1] === `[${activeRef}]` && "rounded bg-primary-200 box-decoration-clone px-1 py-0.5")}>{seg}</span>; // 바로 뒤 번호가 고른 근거면 이 문장에 배경
            const unverified = tone(m[1]) === "warn";
            const picked = m[1] === activeRef && !unverified; // 출처 미확인(주황)은 골라도 경고 색 유지
            return (
              <button key={j} type="button" onClick={() => onCite(m[1])} className="mx-0.5 inline-flex align-middle" title={unverified ? `${describe(m[1])} — 출처 미확인` : describe(m[1])}>
                <Chip tone={picked ? "dark" : tone(m[1])} className="h-5 px-1.5 text-xs">{m[1].startsWith("P") ? `규정 ${m[1].slice(1)}` : `기록 ${m[1].slice(1)}`}</Chip>
              </button>
            );
          })}
        </p>
      );
    });

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); onOpen(); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm hover:bg-primary-50">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">AI</span>
        <span className="line-clamp-2 flex-1 text-ink-muted">{turn.text.replace(/^## .*$/gm, "").replace(/\[[PN]\d+\]/g, "").trim() || turn.error || "답변 없음"}</span>
        <ChevronDown className="size-4 shrink-0 text-ink-muted" />
      </button>
    );
  }

  return (
    <Card className={cn("min-w-0 gap-0 p-4 sm:p-6", highlighted && "ring-2 ring-primary-200")}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">AI</span>
        <span className="font-semibold text-ink">OoM Assistant</span>
        <span className="ml-auto flex items-center gap-2">
          {turn.fromHistory && <Chip tone="neutral" title="검색 내역에서 다시 연 답입니다. 재검색하지 않았습니다">{fmtTime(turn.askedAt)} 답변 다시 보기</Chip>}
          {turn.done && !turn.fromHistory && <Chip title="질문부터 답변 완료까지">답변 {(turn.done.latency.total_ms / 1000).toFixed(1)}초</Chip>}
          {collapsed && <button type="button" onClick={() => setOpen(false)} className="text-xs text-ink-muted hover:text-ink">접기</button>}
        </span>
      </div>

      {turn.text ? <div>{render(turn.text)}</div> : turn.status === "streaming" ? <p className="text-sm text-ink-muted">검색 중…</p> : null}

      {(hasP || hasN) && (
        <p className="mt-3 text-xs text-ink-muted">
          번호는 답의 근거입니다 — {hasP && <><b>규정 n</b> = 규정 문서의 조항(오른쪽 원문)</>}{hasP && hasN && " · "}{hasN && <><b>기록 n</b> = 아래 해결 흐름의 n번째 기록</>}. 번호를 누르면 해당 위치로 이동합니다.
        </p>
      )}

      {turn.policy.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {turn.policy.map((p) => (
            <button key={p.chunk_id} type="button" onClick={() => onCite(p.ref)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", p.ref === activeRef ? "border-primary-700 bg-primary-700 text-white" : c?.verified.includes(p.ref) ? "border-primary-400 bg-primary-50 text-primary-700" : "border-border text-ink-muted")}>
              규정 {p.ref.slice(1)} · {p.doc_title} {p.version} · {shortArticle(p.article_label)}{p.page != null && ` · p.${p.page}`}
            </button>
          ))}
        </div>
      )}

      {chain && (
        <div className="mt-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-ink-muted">비슷한 장애 건의 해결 흐름 <span className="font-normal">(기록 1부터 순서대로)</span></span>
            <Link href={`/w/${wsId}/timeline?entry=${chain.entry_id}`} className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline">
              <ExternalLink className="size-3" /> 타임라인에서 보기
            </Link>
          </div>
          <ChainBlock chain={{ ...chain, nodes: chain.nodes.map((n) => ({ ...n, note: `기록 ${turn.chain!.nodes.find((x) => x.id === n.id)?.ref.slice(1)}` })) }} compact selectedId={activeNode ?? undefined} />
        </div>
      )}

      {turn.status === "error" && (
        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-fail-bg/50 px-3 py-2 text-sm">
          <span className="text-fail">{turn.error ?? "연결이 끊겼습니다"}</span>
          {onRetry && <Button size="xs" variant="outline" onClick={onRetry}><RotateCcw className="size-3" /> 다시 시도</Button>}
        </div>
      )}

      {turn.status === "done" && (
        <>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs">
          <button type="button" onClick={() => setWhy((v) => !v)} aria-expanded={why} title="눌러서 판정 이유 보기" className={cn("inline-flex h-7 items-center gap-1.5 rounded-full px-3 font-semibold", trustTone[trust.level])}>
            <TrustIcon className="size-3.5" aria-hidden />{trustLabel[trust.level]}<ChevronDown className={cn("size-3 transition-transform", why && "rotate-180")} />
          </button>
          {turn.mode === "dag_only" && <Chip>규정 검색 안 함</Chip>}
          <span className="ml-auto flex items-center gap-1.5">
            <span className="text-ink-muted">이 답이 문제 해결에</span>
            <Button variant="outline" size="xs" onClick={() => onVote(turn.vote === 1 ? null : 1)} className={cn(turn.vote === 1 && "border-primary-400 bg-primary-100 text-primary-700")}>도움이 됐어요</Button>
            <Button variant="outline" size="xs" onClick={() => onVote(turn.vote === -1 ? null : -1)} className={cn(turn.vote === -1 && "border-fail bg-fail-bg text-fail")}>부족했어요</Button>
          </span>
        </div>
        {why && (
          <div className={cn("mt-3 rounded-xl border px-4 py-3", trustSoft[trust.level])}>
            <ul className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
              {trust.reasons.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  {r.ok ? <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : trust.level === "none" ? <CircleMinus className="mt-0.5 size-4 shrink-0 text-ref" aria-hidden /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />}
                  {r.text}
                </li>
              ))}
            </ul>
            <p className="mt-2.5 flex items-start gap-2 border-t border-ink/10 pt-2.5 text-xs text-ref">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />번호가 실제 근거 목록에 있는지만 확인합니다. 문장 내용이 조문과 맞는지는 번호를 눌러 직접 확인해 주세요.
            </p>
          </div>        
        )}
        </>
      )}    
      </Card>
  );
}
