"use client";
import { useEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, ChevronDown, Loader2, Square, ExternalLink, RotateCcw, History, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import { ChainBlock } from "@/components/blocks/ChainBlock";
import { SourceViewer } from "@/components/blocks/SourceViewer";
import { fetchSessions, patchSessionScore, streamChat } from "@/lib/api/client";
import type { Chain, ChainEvent, ChatEvent, CitationsEvent, DoneEvent, Intent, Mode, PolicyRef, SearchSession, StageNode, StageStatus, Workspace } from "@/lib/types/domain";

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
  status: "done", query: x.query, askedAt: x.created_at, sessionId: x.id, stages: {}, intent: x.intent, mode: x.mode,
  policy: x.policy, chain: x.chain, text: x.answer_text, citations: x.citations,
  done: { intent: x.intent, retrieved_ids: [], verified_ids: [], unverified_ids: [], latency: x.latency, model: "", prompt_tokens: 0, completion_tokens: 0 },
  error: null, vote: x.score, fromHistory: true,
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
// B-11 추천 질문: 워크스페이스 모드별 정적 3개. 실서버 전환 후에도 정적 유지(검색 내역 기반 추천은 R-목록)
const suggestions = (policy: boolean): string[] =>
  policy
    ? ["외근 중 VPN 접속하면 E-403이 떠요. 왜 그런가요?", "원격접속 신청 기간은 최대 며칠인가요?", "접속이 차단되면 어디서 확인하나요?"]
    : ["VPN E-403이 반복돼요. 해결한 사례 있나요?", "게이트웨이 시간이 어긋나서 토큰이 만료되는 것 같아요", "FAQ 연동 API 504 타임아웃 원인이 뭐였나요?"];
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
  const endRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true); // 사용자가 위로 올려 읽는 중이면 자동 스크롤을 멈춘다
  const policyMode = ws.policy_enabled;
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
  useEffect(() => { stickToBottom.current = true; scrollToEnd("auto"); }, [state.turns.length]);
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
    if (idx >= 0) { setSourceTurn(idx === state.turns.length - 1 ? null : idx); setActiveRef(x.policy[0]?.ref ?? null); return; }
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
    if (ref.startsWith("P")) { setActiveRef(ref); return; }
    const node = turn.chain?.nodes.find((n) => n.ref === ref);
    if (node) setActiveNode(node.id);
  };
  const sourceIndex = sourceTurn ?? state.turns.length - 1;
  const sourceOf = state.turns[sourceIndex];

  return (
    <main className={cn("grid flex-1 items-start gap-6 p-4 md:p-6 xl:p-8", policyMode ? "xl:grid-cols-[minmax(0,1fr)_340px]" : "grid-cols-1")}>
      <section className={cn("flex min-w-0 flex-col md:h-[calc(100dvh-8rem)] xl:h-[calc(100dvh-9rem)]", !policyMode && "mx-auto w-full max-w-4xl")}>
        <div ref={listRef} onScroll={onListScroll} className="flex flex-1 flex-col gap-4 md:min-h-0 md:overflow-y-auto md:pr-1">
          {state.turns.length === 0 ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-center text-sm text-ink-muted">
              <p className="font-medium text-ink">{policyMode ? "규정 근거와 과거 장애 해결 사례를 한 번에 물어보세요." : "이 워크스페이스는 해결 사례만 검색합니다. 겪고 있는 오류나 증상을 물어보세요."}</p>
              <div className="mt-1 flex flex-wrap justify-center gap-2">
                {suggestions(policyMode).map((q) => (
                  <button key={q} type="button" onClick={() => ask(q)} className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-ink hover:bg-primary-50">{q}</button>
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
              {history.open && <HistoryPanel history={history} onPick={reopen} onClose={() => setHistory((h) => ({ ...h, open: false }))} />}
              {state.turns.map((t, i) => {
                const isLast = i === state.turns.length - 1;
                return (
                  <div key={`${t.askedAt}-${i}`} className="flex flex-col gap-3">
                    <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-ink px-5 py-3 text-sm leading-relaxed text-white sm:max-w-[62%]">
                      {t.query}
                      <span className="mt-1 block text-right text-[11px] text-white/60">{fmtTime(t.askedAt)}</span>
                    </div>
                    {isLast && <PipelineBadges turn={t} />}
                    <AnswerCard key={`${t.askedAt}-${isLast ? "open" : "folded"}`} turn={t} wsId={ws.id} collapsed={!isLast} highlighted={sourceIndex === i && !isLast} activeNode={sourceIndex === i ? activeNode : null} onOpen={() => { setSourceTurn(isLast ? null : i); setActiveRef(t.policy[0]?.ref ?? null); }} onCite={(ref) => cite(i, t, ref)} onVote={(v) => vote(i, v)} onRetry={isLast && !streaming ? () => ask(t.query) : undefined} />
                  </div>
                );
              })}
              <div ref={endRef} />
            </>
          )}
        </div>

        <div className="sticky bottom-0 mt-4 bg-background pb-2 pt-2 md:static">
          <form className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 pl-5 shadow-sm" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder={policyMode ? "규정이나 과거 장애 해결 사례를 물어보세요" : "겪고 있는 오류나 증상을 적어 보세요"} className="h-11 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" disabled={streaming} />
            {streaming ? (
              <Button type="button" variant="outline" size="lg" className="size-11 rounded-full p-0" onClick={stop} aria-label="중지"><Square className="size-4" /></Button>
            ) : (
              <Button type="submit" size="lg" className="size-11 rounded-full p-0" disabled={!input.trim()} aria-label="질문 보내기"><ArrowUp className="size-5" /></Button>
            )}
          </form>
        </div>
      </section>

      {policyMode && (
        <SourceViewer
          sources={sourceOf?.policy ?? []}
          activeRef={activeRef}
          onSelect={setActiveRef}
          context={sourceOf && sourceTurn !== null ? { query: sourceOf.query, onBack: () => { setSourceTurn(null); setActiveRef(current?.policy[0]?.ref ?? null); } } : undefined}
        />
      )}
    </main>
  );
}

// ── 검색 내역 패널: 서버 저장분. 누르면 저장된 답을 그대로 다시 연다(재검색 없음) ──
function HistoryPanel({ history, onPick, onClose }: { history: { items: SearchSession[]; loading: boolean }; onPick: (x: SearchSession) => void; onClose: () => void }) {
  return (
    <Card className="gap-2 p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-ink">검색 내역 <span className="font-normal text-ink-muted">이 워크스페이스에서 물어본 질문. 누르면 그때 답을 다시 봅니다</span></span>
        <button type="button" onClick={onClose} aria-label="닫기" className="rounded p-1 text-ink-muted hover:bg-primary-100"><X className="size-4" /></button>
      </div>
      {history.loading ? <p className="text-xs text-ink-muted">불러오는 중…</p> : history.items.length === 0 ? <p className="text-xs text-ink-muted">아직 기록이 없습니다.</p> : (
        <ol className="max-h-64 divide-y divide-border overflow-y-auto">
          {history.items.map((x) => (
            <li key={x.id}>
              <button type="button" onClick={() => onPick(x)} className="flex w-full items-center gap-3 px-1 py-2 text-left text-sm hover:bg-primary-50">
                <span className="w-24 shrink-0 text-[11px] tabular-nums text-ink-muted">{new Date(x.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{x.query}</span>
                <Chip className="h-5 shrink-0 text-[11px]">{intentLabel[x.intent]}</Chip>
                <span className="w-14 shrink-0 text-right text-[11px] text-ink-muted">근거 {x.citations.verified.length}</span>
                <span className="w-5 shrink-0 text-center text-[11px]">{x.score === 1 ? "👍" : x.score === -1 ? "👎" : ""}</span>
                <span className="hidden w-12 shrink-0 text-right text-[11px] text-ink-muted sm:block">{x.user_name}</span>
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
              {label}{st?.detail ? ` · ${st.detail}` : ""}
            </Chip>
          </span>
        );
      })}
      {turn.intent && <Chip tone="dark" title="질문 분석 결과">{intentLabel[turn.intent]}</Chip>}
    </div>
  );
}

// ── 답변 카드 ───────────────────────────────────────────────────────────────
function AnswerCard({ turn, wsId, collapsed, highlighted, activeNode, onOpen, onCite, onVote, onRetry }: { turn: Turn; wsId: number; collapsed: boolean; highlighted: boolean; activeNode: number | null; onOpen: () => void; onCite: (ref: string) => void; onVote: (v: 1 | -1 | null) => void; onRetry?: () => void }) {
  const [open, setOpen] = useState(!collapsed);
  const c = turn.citations;
  const tone = (ref: string) => (!c ? "neutral" : c.verified.includes(ref) ? "primary" : c.unverified.includes(ref) ? "warn" : "neutral");
  const chain: Chain | null = turn.chain
    ? { entry_id: turn.chain.entry_id, edges: turn.chain.edges, summary: null, nodes: turn.chain.nodes.map((n) => ({ ...n, note: null })) }
    : null;
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
          {line.split(/(\[[PN]\d+\])/g).map((seg, j) => {
            const m = /^\[([PN]\d+)\]$/.exec(seg);
            if (!m) return <span key={j}>{seg}</span>;
            const unverified = tone(m[1]) === "warn";
            return (
              <button key={j} type="button" onClick={() => onCite(m[1])} className="mx-0.5 inline-flex align-middle" title={unverified ? `${describe(m[1])} — 출처 미확인` : describe(m[1])}>
                <Chip tone={tone(m[1])} className="h-5 px-1.5 text-[11px]">{m[1].startsWith("P") ? `규정 ${m[1].slice(1)}` : `기록 ${m[1].slice(1)}`}</Chip>
              </button>
            );
          })}
        </p>
      );
    });

  if (!open) {
    return (
      <button type="button" onClick={() => { setOpen(true); onOpen(); }} className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left text-sm hover:bg-primary-50">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[10px] font-bold text-white">AI</span>
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
        <p className="mt-3 text-[11px] text-ink-muted">
          번호는 답의 근거입니다 — {hasP && <><b>규정 n</b> = 규정 문서의 조항(오른쪽 원문)</>}{hasP && hasN && " · "}{hasN && <><b>기록 n</b> = 아래 해결 흐름의 n번째 기록</>}. 번호를 누르면 해당 위치로 이동합니다.
        </p>
      )}

      {turn.policy.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {turn.policy.map((p) => (
            <button key={p.chunk_id} type="button" onClick={() => onCite(p.ref)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", c?.verified.includes(p.ref) ? "border-primary-400 bg-primary-50 text-primary-700" : "border-border text-ink-muted")}>
              규정 {p.ref.slice(1)} · {p.doc_title} {p.version} · {p.article_label.split(" ")[0]} · p.{p.page}
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
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-xs">
          <Chip tone={c?.verified.length ? "primary" : "neutral"} title="답변 속 번호가 실제 근거와 맞는지 대조한 결과">근거 {c?.verified.length ?? 0}건 확인됨</Chip>
          {!!c?.unverified.length && <Chip tone="warn" title="답변에 적힌 번호인데 찾은 근거 목록에 없음">근거 미확인 {c.unverified.length}건</Chip>}
          {turn.mode === "dag_only" && <Chip>규정 검색 안 함</Chip>}
          <span className="ml-auto flex items-center gap-1.5">
            <span className="text-ink-muted">이 답이 문제 해결에</span>
            <Button variant="outline" size="xs" onClick={() => onVote(turn.vote === 1 ? null : 1)} className={cn(turn.vote === 1 && "border-primary-400 bg-primary-100 text-primary-700")}>도움이 됐어요</Button>
            <Button variant="outline" size="xs" onClick={() => onVote(turn.vote === -1 ? null : -1)} className={cn(turn.vote === -1 && "border-fail bg-fail-bg text-fail")}>부족했어요</Button>
          </span>
        </div>
      )}
    </Card>
  );
}
