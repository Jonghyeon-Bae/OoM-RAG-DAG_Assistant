"use client";
import { useReducer, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUp, Loader2, Square, ThumbsDown, ThumbsUp, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import { ChainBlock } from "@/components/blocks/ChainBlock";
import { SourceViewer } from "@/components/blocks/SourceViewer";
import { streamChat } from "@/lib/api/client";
import type { Chain, ChainEvent, ChatEvent, CitationsEvent, DoneEvent, Intent, Mode, PolicyRef, StageNode, StageStatus, Workspace } from "@/lib/types/domain";

// ── 상태: SSE 이벤트 9종이 차례로 채운다 ─────────────────────────────────────
type Status = "idle" | "streaming" | "done" | "error";
interface ChatState {
  status: Status;
  query: string;
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
}
const initial: ChatState = { status: "idle", query: "", sessionId: null, stages: {}, intent: null, mode: null, policy: [], chain: null, text: "", citations: null, done: null, error: null };
type Action = { type: "start"; query: string } | { type: "event"; e: ChatEvent } | { type: "fail"; message: string } | { type: "stop" };

function reducer(s: ChatState, a: Action): ChatState {
  switch (a.type) {
    case "start": return { ...initial, status: "streaming", query: a.query };
    case "fail":  return { ...s, status: "error", error: a.message };
    case "stop":  return s.status === "streaming" ? { ...s, status: "done" } : s;
    case "event": {
      const { e } = a;
      switch (e.event) {
        case "session":   return { ...s, sessionId: e.data.session_id };
        case "stage":     return { ...s, stages: { ...s.stages, [e.data.node]: { status: e.data.status, detail: e.data.detail } } };
        case "intent":    return { ...s, intent: e.data.intent, mode: e.data.mode };
        case "policy":    return { ...s, policy: e.data };
        case "chain":     return { ...s, chain: e.data };
        case "token":     return { ...s, text: s.text + e.data.text };
        case "citations": return { ...s, citations: e.data };
        case "done":      return { ...s, status: "done", done: e.data };
        case "error":     return { ...s, status: "error", error: e.data.message };
      }
    }
  }
}

// ── 화면 라벨 ──────────────────────────────────────────────────────────────
const stageLabel: { node: StageNode; label: string }[] = [
  { node: "supervisor", label: "Supervisor" },
  { node: "policy_rag", label: "Worker · 규정 RAG" },
  { node: "graph_search", label: "Worker · 트러블슈팅 DAG" },
  { node: "gate", label: "Gate" },
  { node: "generate", label: "Generate" },
  { node: "critic", label: "Critic · 출처 검증" },
];
const intentLabel: Record<Intent, string> = { policy: "규정 질의", troubleshoot: "트러블슈팅 질의", both: "복합 질의" };

export function AssistantScreen({ ws }: { ws: Workspace }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const [input, setInput] = useState("");
  const [activeRef, setActiveRef] = useState<string | null>(null);
  const ctrl = useRef<AbortController | null>(null);
  const policyMode = ws.policy_enabled;
  const streaming = state.status === "streaming";

  const stop = () => {
    ctrl.current?.abort();
    ctrl.current = null;
    dispatch({ type: "stop" });
  };

  const ask = async (q: string) => {
    const query = q.trim();
    if (!query || streaming) return;
    ctrl.current?.abort();
    const ac = new AbortController();
    ctrl.current = ac;
    setInput("");
    setActiveRef(null);
    dispatch({ type: "start", query });
    try {
      await streamChat(
        ws.id,
        query,
        (e) => {
          dispatch({ type: "event", e });
          if (e.event === "policy" && e.data.length) setActiveRef((cur) => cur ?? e.data[0].ref); // 첫 출처 자동 선택
        },
        ac.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") dispatch({ type: "fail", message: err instanceof Error ? err.message : "스트림 오류" });
    } finally {
      if (ctrl.current === ac) ctrl.current = null;
    }
  };

  return (
    <main className={cn("grid flex-1 items-start gap-6 p-8", policyMode ? "grid-cols-[1fr_340px]" : "grid-cols-1")}>
      <section className={cn("flex min-h-[calc(100vh-7rem)] flex-col", !policyMode && "mx-auto w-full max-w-4xl")}>
        <div className="flex flex-1 flex-col gap-4">
          {state.status === "idle" ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-sm text-ink-muted">
              <p className="font-medium text-ink">{policyMode ? "규정 근거와 과거 장애 해결 사례를 한 번에 물어보세요." : "이 워크스페이스는 DAG 단일 모드입니다. 과거 장애 해결 사례를 물어보세요."}</p>
              <p>아래 입력창에 질문을 입력하세요.</p>
            </div>
          ) : (
            <>
              <div className="ml-auto max-w-[62%] rounded-2xl rounded-tr-sm bg-ink px-6 py-4 text-sm leading-relaxed text-white">{state.query}</div>
              <PipelineBadges state={state} />
              <AnswerCard state={state} wsId={ws.id} onCite={setActiveRef} />
            </>
          )}
        </div>

        <div className="mt-6">
          <form className="flex items-center gap-3 rounded-2xl border border-border bg-card p-2 pl-5" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="규정이나 과거 장애 해결 사례를 자연어로 질문해 보세요" className="h-11 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0" disabled={streaming} />
            {streaming ? (
              <Button type="button" variant="outline" size="lg" className="size-11 rounded-full p-0" onClick={stop} aria-label="중지"><Square className="size-4" /></Button>
            ) : (
              <Button type="submit" size="lg" className="size-11 rounded-full p-0" disabled={!input.trim()} aria-label="질문 보내기"><ArrowUp className="size-5" /></Button>
            )}
          </form>
        </div>
      </section>

      {policyMode && <SourceViewer sources={state.policy} activeRef={activeRef} onSelect={setActiveRef} />}
    </main>
  );
}

// ── 파이프라인 배지: stage 이벤트로 켜진다. DAG 단일에선 규정 RAG 가 아예 안 뜬다 ──
function PipelineBadges({ state }: { state: ChatState }) {
  const always: StageNode[] = ["supervisor", "gate", "generate", "critic"];
  const shown = stageLabel.filter(({ node }) => state.stages[node] || (state.status === "streaming" && always.includes(node)));
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {shown.map(({ node, label }, i) => {
        const st = state.stages[node];
        return (
          <span key={node} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="size-4 text-ink-muted" />}
            <Chip tone={st?.status === "error" ? "fail" : st?.status === "done" ? "primary" : st?.status === "start" ? "warn" : "neutral"} className={cn(!st && "opacity-40")}>
              {st?.status === "start" && <Loader2 className="mr-1 size-3 animate-spin" />}
              {label}{st?.detail ? ` · ${st.detail}` : ""}
            </Chip>
          </span>
        );
      })}
      {state.intent && <Chip tone="dark">{intentLabel[state.intent]}</Chip>}
    </div>
  );
}

// ── 답변 카드 ───────────────────────────────────────────────────────────────
function AnswerCard({ state, wsId, onCite }: { state: ChatState; wsId: number; onCite: (ref: string) => void }) {
  const [vote, setVote] = useState<1 | -1 | null>(null);
  const c = state.citations;
  const tone = (ref: string) => (!c ? "neutral" : c.verified.includes(ref) ? "primary" : c.unverified.includes(ref) ? "warn" : "neutral");
  const chain: Chain | null = state.chain
    ? { entry_id: state.chain.entry_id, edges: state.chain.edges, summary: null, nodes: state.chain.nodes.map((n) => ({ ...n, note: null })) }
    : null;

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
            return (
              <button key={j} type="button" onClick={() => onCite(m[1])} className="mx-0.5 inline-flex align-middle" title={tone(m[1]) === "warn" ? "출처 미확인" : undefined}>
                <Chip tone={tone(m[1])} className="h-5 px-1.5 text-[11px]">{m[1]}</Chip>
              </button>
            );
          })}
        </p>
      );
    });

  return (
    <Card className="gap-0 p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">AI</span>
        <span className="font-semibold text-ink">OoM Assistant</span>
        {state.done && <Chip className="ml-auto">답변 생성 {(state.done.latency.total_ms / 1000).toFixed(1)}초</Chip>}
      </div>

      {state.text ? <div>{render(state.text)}</div> : state.status === "streaming" ? <p className="text-sm text-ink-muted">검색 중…</p> : null}

      {state.policy.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {state.policy.map((p) => (
            <button key={p.chunk_id} type="button" onClick={() => onCite(p.ref)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", c?.verified.includes(p.ref) ? "border-primary-400 bg-primary-50 text-primary-700" : "border-border text-ink-muted")}>
              [{p.ref}] {p.doc_title} {p.version} · {p.article_label.split(" ")[0]} · p.{p.page}
            </button>
          ))}
        </div>
      )}

      {chain && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted">유사 장애 해결 체인</span>
            <Link href={`/w/${wsId}/timeline?entry=${chain.entry_id}`} className="inline-flex items-center gap-1 text-xs text-primary-700 hover:underline">
              <ExternalLink className="size-3" /> 타임라인에서 보기
            </Link>
          </div>
          <ChainBlock chain={chain} compact />
        </div>
      )}

      {state.status === "error" && <p className="mt-4 text-sm text-fail">{state.error}</p>}

      {state.status === "done" && (
        <div className="mt-5 flex items-center gap-2 border-t border-border pt-4 text-xs">
          <Chip tone={c?.verified.length ? "primary" : "neutral"}>출처 {c?.verified.length ?? 0}건 검증</Chip>
          {!!c?.unverified.length && <Chip tone="warn">미확인 {c.unverified.length}건</Chip>}
          {state.mode === "dag_only" && <Chip>규정 검색 생략</Chip>}
          {/* TODO Tier 1: POST /api/feedback { session_id: state.sessionId, score } */}
          <span className="ml-auto flex gap-1">
            <Button variant="outline" size="xs" onClick={() => setVote(vote === 1 ? null : 1)} className={cn(vote === 1 && "bg-primary-100 text-primary-700")} aria-label="도움이 됐어요"><ThumbsUp className="size-3" /></Button>
            <Button variant="outline" size="xs" onClick={() => setVote(vote === -1 ? null : -1)} className={cn(vote === -1 && "bg-fail-bg text-fail")} aria-label="도움이 안 됐어요"><ThumbsDown className="size-3" /></Button>
          </span>
        </div>
      )}
    </Card>
  );
}