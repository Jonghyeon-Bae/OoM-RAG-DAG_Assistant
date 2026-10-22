"use client";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import { ChainBlock } from "@/components/blocks/ChainBlock";
import type { Chain, PolicyRef } from "@/lib/types/domain";

type Props = {
  policy: PolicyRef[];
  policyText: string | null;
  chain: Chain | null;
  chainText: string | null;
  verified: string[];
  unverified: string[];
  totalMs: number | null;
  onCite?: (ref: string) => void;
};

export function AnswerCard({ policy, policyText, chain, chainText, verified, unverified, totalMs, onCite }: Props) {
  const tone = (ref: string) => (verified.includes(ref) ? "primary" : unverified.includes(ref) ? "warn" : "neutral");

  // "[P1]" 마커 → 칩. 텍스트는 지우지 않고 칩 색만 바뀐다 (Critic은 생성 후 판정)
  const render = (text: string) =>
    text.split(/(\[[PN]\d+\])/g).map((seg, i) => {
      const m = /^\[([PN]\d+)\]$/.exec(seg);
      if (!m) return <span key={i}>{seg}</span>;
      return (
        <button key={i} type="button" onClick={() => onCite?.(m[1])} className="mx-0.5 inline-flex align-middle"title={tone(m[1]) === "warn" ? "출처 미확인" : undefined}>
          <Chip tone={tone(m[1])} className="h-5 px-1.5 text-[11px]">{m[1]}</Chip>
        </button>
      );
    });

  return (
    <Card className="gap-0 p-6">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-ink text-xs font-bold text-white">AI</span>
        <span className="font-semibold text-ink">OoM Assistant</span>
        {totalMs != null && <Chip className="ml-auto">답변 생성 {(totalMs / 1000).toFixed(1)}초</Chip>}
      </div>

      {policy.length > 0 && policyText && (
        <section className="mb-6">
          <h3 className="mb-2 text-sm font-bold text-primary-700">① 규정 근거</h3>
          <p className="text-sm leading-relaxed text-ink">{render(policyText)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {policy.map((p) => (
              <button key={p.chunk_id} type="button" onClick={() => onCite?.(p.ref)} className={cn("rounded-full border px-3 py-1 text-xs transition-colors", verified.includes(p.ref) ? "border-primary-400 bg-primary-50 text-primary-700" : "border-border text-ink-muted")}>
                [{p.ref}] {p.doc_title} {p.version} · {p.article_label.split(" ")[0]} · p.{p.page}
              </button>
            ))}
          </div>
        </section>
      )}

      {chain && (
        <section>
          <h3 className="mb-3 text-sm font-bold text-ink">{policy.length ? "② " : ""}유사 장애 해결 사례 (DAG 체인)</h3>
          <ChainBlock chain={chain} compact />
          {chainText && <p className="mt-3 text-sm leading-relaxed text-ink-muted">{render(chainText)}</p>}
        </section>
      )}

      {!policy.length && !chain && <p className="text-sm text-ink-muted">등록된 규정이나 과거 해결 사례에서 근거를 찾지 못했습니다.</p>}

      {/* 푸터 — 실시간 RAGAS 없음. 출처 검증 결과만 */}
      <div className="mt-5 flex items-center gap-2 border-t border-border pt-4">
        <Chip tone={verified.length ? "primary" : "neutral"}>출처 {verified.length}건 검증</Chip>
        {unverified.length > 0 && <Chip tone="warn">미확인 {unverified.length}건</Chip>}
        <span className="ml-auto flex gap-1">
          {/* TODO Tier 1: POST /api/feedback */}
          <Button variant="outline" size="xs" aria-label="도움이 됐어요"><ThumbsUp className="size-3" /></Button>
          <Button variant="outline" size="xs" aria-label="도움이 안 됐어요"><ThumbsDown className="size-3" /></Button>
        </span>
      </div>
    </Card>
  );
}