"use client";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, CornerDownRight } from "lucide-react";
import type { Chain, ChainNode, NodePolicyRef, PolicyRelation } from "@/lib/types/domain";
import { cn, typeLabel } from "@/components/ui";
import { relationLabel } from "@/lib/relation";
import { PolicyArticleDialog } from "@/components/blocks/PolicyArticleDialog";

// B-17 / B-45: 깊이별 열(root → 원인 → 해결)로 배치한 체인 블록. 타임라인 그래프(ChainGraph)와 어시스턴트 답변 카드 공용.
// FE-012 P1-7·8: 원인/해결 표시, 근거 조문(따름·예외·기준 없음), 이 상위에 이어 붙인 이유
// 카드는 흰 바탕에 두고 유형 색은 왼쪽 띠와 유형 글자에만 쓴다 — 색 면이 줄어 선과 원인·해결 표시가 먼저 보인다
// 띠는 카드의 왼쪽 테두리 자체다 — 선택 테두리(바깥 링)와 같은 곡선을 따라가 모서리에서 어긋나 보이지 않는다
const bar: Record<ChainNode["type"], string> = {
  fail: "border-l-fail",
  success: "border-l-success",
  ref: "border-l-ref",
};
const tone: Record<ChainNode["type"], string> = { fail: "text-fail", success: "text-success", ref: "text-ref" };

export { relationLabel };
const relationTone: Record<PolicyRelation, string> = {
  follows: "bg-primary-100 text-primary-700",
  exception: "bg-warn-bg text-warn",
  gap: "bg-ref-bg text-ink-muted",
};
// 조문 표기: "환불 규정 제7조" — RefView(REST)는 doc_title+article_label, SSE 는 label 하나만 온다
const refText = (p: NodePolicyRef) => [p.doc_title, p.article_label].filter(Boolean).join(" ") || p.topic || "";

// 원문(article_text)이 있거나 다시 연결이 필요한(replaced) 근거는 누르면 조문 창이 뜬다. 어시스턴트 답변 카드(SSE 축약형)는 원문이 없어 글만 보인다
function PolicyLine({ p, nodeId, refs, index }: { p: NodePolicyRef; nodeId: number; refs: NodePolicyRef[]; index: number }) {
  const [open, setOpen] = useState(false);
  const text = refText(p) || (p.revision === "replaced" ? p.from_label ?? "" : "");
  const openable = !!p.article_text || p.revision === "replaced";
  const title = [relationLabel[p.relation], text, p.note, p.revision && `개정: ${p.from_label ?? "이전"} → ${p.revision}`].filter(Boolean).join(" · ");
  const inner = (
    <>
      <span className={cn("shrink-0 rounded px-1.5 py-0.5 font-semibold", relationTone[p.relation])}>{relationLabel[p.relation]}</span>
      {text && <span className={cn("truncate text-ink-muted", openable && "underline decoration-dotted underline-offset-2")}>{text}</span>}
      {p.revision === "replaced" ? <span className="shrink-0 rounded bg-warn px-1 text-white">다시 연결 필요</span> : p.revision && <span className="shrink-0 rounded bg-warn-bg px-1 text-warn">개정</span>}
    </>
  );
  if (!openable) return <li className="flex min-w-0 items-center gap-1.5 text-xs" title={title}>{inner}</li>;
  // 카드 전체가 "고르기" 버튼인 화면(타임라인)에서도 조문만 따로 열리게 이벤트를 여기서 멈춘다
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <li className="min-w-0 text-xs" onClick={stop} onKeyDown={stop}>
      <button type="button" onClick={() => setOpen(true)} title={`${title} — 눌러서 조문 보기`} className="flex w-full min-w-0 items-center gap-1.5 rounded text-left hover:bg-primary-50">{inner}</button>
      {open && <PolicyArticleDialog nodeId={nodeId} refs={refs} index={index} open onClose={() => setOpen(false)} />}
    </li>
  );
}

// fluid = 세로 배치용(칸 폭을 다 쓰고, 앞 단계가 여러 장일 때만 "앞 기록" 제목을 적는다. 경로 표기는 생략)
export function ChainNodeCard({ node, compact = false, selected = false, reasons = [], fluid = false, parents = [] }: { node: ChainNode; compact?: boolean; selected?: boolean; reasons?: string[]; fluid?: boolean; parents?: string[] }) {
  const deprecated = node.status === "deprecated";
  const refs = node.policy_refs ?? [];
  const shown = compact ? refs.slice(0, 1) : refs.slice(0, 2);
  return (
    <div
      className={cn(
        "rounded-xl border border-l-4 bg-card py-2.5 pl-[13px] pr-3 text-ink sm:py-3 sm:pl-[17px] sm:pr-4",
        fluid ? "w-full" : compact ? "min-w-[12.5rem] max-w-[17.5rem]" : "min-w-[13.75rem] max-w-[17.5rem]",
        deprecated && "opacity-50 grayscale-[0.4]",
        selected ? "border-primary-700 ring-2 ring-primary-400" : "border-border",
        bar[node.type],
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium">
        <span className={cn("font-semibold", tone[node.type])}>{typeLabel[node.type]}</span>
        {node.is_cause && <span className="rounded-full bg-fail px-2 py-0.5 text-xs text-white" title="이 장애 건의 원인으로 표시된 기록">원인</span>}
        {node.resolves_root && <span className="rounded-full bg-success px-2 py-0.5 text-xs text-white" title="이 장애 건을 해결한 기록">해결</span>}
        {deprecated && <span className="ml-auto rounded-full bg-ref-bg px-2 py-0.5 text-xs text-ref">폐기</span>}
      </div>
      <div className="mt-1 text-sm font-semibold leading-snug">{node.title}</div>
      {fluid && parents.length > 0 && <p className="mt-1 text-xs text-ink-muted">앞 기록: {parents.join(" · ")}</p>}
      {(node.note || (!compact && !fluid && node.path_label)) && <div className="mt-1 text-xs text-ink-muted">{node.note ?? node.path_label}</div>}
      {!compact && reasons.length > 0 && (
        <p className="mt-1.5 flex items-start gap-1 text-xs italic text-ink-muted" title="앞 기록에 이어 붙인 이유">
          <CornerDownRight className="mt-0.5 size-3 shrink-0" />
          <span className="line-clamp-2">{reasons.join(" / ")}</span>
        </p>
      )}
      {shown.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 border-t border-border pt-2">
          {shown.map((p, i) => <PolicyLine key={i} p={p} nodeId={node.id} refs={refs} index={i} />)}
          {refs.length > shown.length && <li className="text-xs text-ink-muted">근거 조문 {refs.length - shown.length}건 더</li>}
        </ul>
      )}
    </div>
  );
}

// 노드별로 "이 노드를 상위에 이어 붙인 이유" 모음 (중복 제거)
export const reasonsByChild = (chain: Chain) => {
  const m = new Map<number, string[]>();
  for (const e of chain.edges) {
    if (!e.reason) continue;
    const a = m.get(e.child_id) ?? [];
    if (!a.includes(e.reason)) a.push(e.reason);
    m.set(e.child_id, a);
  }
  return m;
};

// 가로(열) 배치가 칸에 들어가지 않으면 세로(단계별)로 — 화면 폭 경계가 아니라 실제 칸 폭 기준(D-004·D-012, #102)
export const CARD_MAX = 280;
export function useFits(need: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => setFits(el.clientWidth >= need);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [need, fits]); // 배치가 바뀌면 ref 대상 요소가 바뀔 수 있어 다시 관찰
  return { ref, fits };
}

export const parentsByChild = (chain: Chain) => {
  const title = new Map(chain.nodes.map((n) => [n.id, n.title]));
  const m = new Map<number, string[]>();
  for (const e of chain.edges) {
    const t = title.get(e.parent_id);
    if (t) m.set(e.child_id, [...(m.get(e.child_id) ?? []), t]);
  }
  return m;
};

export const stepLabel = (i: number) => (i === 0 ? "시작" : `${i}단계`);

export function ChainBlock({ chain, compact = false, selectedId }: { chain: Chain; compact?: boolean; selectedId?: number }) {
  const depths = [...new Set(chain.nodes.map((n) => n.depth))].sort((a, b) => a - b);
  const reasons = reasonsByChild(chain);
  const parents = parentsByChild(chain);
  const { ref, fits } = useFits(depths.length * CARD_MAX + (depths.length - 1) * 40);
  return (
    <div ref={ref} className="min-w-0">
      {fits ? (
        
        <div className="flex items-start gap-3">
          {depths.map((d, i) => (
            <div key={d} className="flex items-start gap-3">
              <div className="flex flex-col gap-3">
                {chain.nodes.filter((n) => n.depth === d).map((n) => (
                  <ChainNodeCard key={n.id} node={n} compact={compact} selected={n.id === selectedId} reasons={reasons.get(n.id)} />
                ))}
              </div>
              {i < depths.length - 1 && <ArrowRight className="mt-5 size-4 shrink-0 text-ink-muted" />}
            </div>
          ))}
        </div>
      ) : (
        <ol className="flex flex-col gap-1">
          {depths.map((d, i) => (
            <li key={d}>
              {i > 0 && <ArrowDown className="mx-auto mb-1 size-4 text-ink-muted" />}
              <div className="mb-1 text-xs font-semibold text-ink-muted">{stepLabel(i)}</div>
              <div className="flex flex-col gap-2">
                {chain.nodes.filter((n) => n.depth === d).map((n) => (
                  <ChainNodeCard key={n.id} node={n} compact={compact} fluid selected={n.id === selectedId} reasons={reasons.get(n.id)} parents={i > 0 && chain.nodes.filter((x) => x.depth === depths[i - 1]).length > 1 ? parents.get(n.id) : []} />
                ))}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
