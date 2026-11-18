"use client";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import type { PolicyRef } from "@/lib/types/domain";
import { shortArticle } from "@/lib/article";
import { PolicyTable } from "@/components/blocks/PolicyTable";
import { citedSentences, isFirstPiece, partsOf, policyBlocks, usedParts } from "@/lib/policyText";

// JSON 근거 카드 (03 안건 A). 청크 텍스트를 ①②③ 항 단위로 쪼개 보여 준다. 표("| 칸 |" 줄)는 표로 그린다. react-pdf 원문은 Tier 2.
// answer: 그 답변의 글. 넘기면 답변 문장과 글이 겹치는 항(표는 줄)만 답변과 같은 색으로 칠하고 그 자리로 옮긴다.
//         서버가 알려 주는 값이 아니라 글자 겹침으로 고른 추정이다(lib/policyText) — 그래서 카드 아래에 그렇게 적는다
// bare: 근거 창(폰) 안에 넣을 때 — 바깥 테두리와 제목 줄을 뺀다(창에 이미 제목이 있다)
// onOpenFile: PDF 원문 보기를 여는 함수. 넘기지 않으면 "원문 전체 보기" 버튼이 꺼진 채로 남는다
export function SourceViewer({ sources, activeRef, onSelect, context, current, bare, onOpenFile, answer }: { sources: PolicyRef[]; activeRef: string | null; onSelect: (ref: string) => void; context?: { query: string; onBack?: () => void }; current?: boolean; bare?: boolean; onOpenFile?: (source: PolicyRef) => void; answer?: string }) {
  const active = sources.find((s) => s.ref === activeRef) ?? sources[0];
  const blocks = active ? policyBlocks(active.text, isFirstPiece(active.chunk_id)) : [];
  const parts = partsOf(blocks); // 항 하나 · 표의 한 줄이 조각 하나
  const sentences = active && answer ? citedSentences(answer, active.ref) : []; // 답변에서 이 조문 번호가 붙은 문장
  const used = usedParts(sentences, parts);
  const firstUsed = used.size ? Math.min(...used) : -1;
  // 조문 아래 안내: 표시가 추정이라는 것, 표시가 없는 이유
  const note = answer === undefined || parts.length < 2 ? null
    : sentences.length === 0 ? "답변 글에서 직접 인용하지 않은 조문입니다. 표시 없이 전체를 보여 줍니다."
    : used.size === 0 ? "답변 문장과 뚜렷이 겹치는 부분을 찾지 못해 표시하지 않았습니다. 조문 전체를 확인해 주세요."
    : "답변 문장과 겹치는 말이 많은 부분을 표시했습니다. 글이 비슷한지로 고른 것이니 앞뒤 내용도 함께 확인해 주세요.";
  // 고른 조문이나 표시한 항이 바뀌면 그 항이 보이게 옮기고 한 번 깜빡인다 (폰의 근거 창은 열릴 때)
  const bodyRef = useRef<HTMLDivElement>(null);
  const usedKey = `${active?.chunk_id ?? ""}:${[...used].join(",")}`;
  useEffect(() => {
    const el = bodyRef.current?.querySelector<HTMLElement>("[data-used]");
    if (!el) return;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) el.animate([{ opacity: 1 }, { opacity: 0.35 }, { opacity: 1 }], { duration: 700 });
  }, [usedKey]);
  const usedBadge = (what: string) => <span className="w-fit rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white">규정 {active?.ref.slice(1)} · 답변에 쓰인 {what}</span>;

  return (
    // 오른쪽 패널: 흰 바탕 + 테두리 + 왼쪽 강조선으로 대화 영역과 구분, 스크롤해도 따라오게 sticky
    <aside className={cn("flex min-w-0 flex-col gap-3", !bare && "overflow-y-auto rounded-2xl border border-border border-l-4 border-l-primary-700 bg-card p-5 shadow-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]")}>
      {!bare && (
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-bold text-ink">규정 원문</h2>
          <Chip tone="primary" className="text-xs" title="답변에 인용된 조항을 항 단위로 보여줍니다">인용된 조항</Chip>
        </div>
      )}

      {context && (
        <div className={cn("flex items-start gap-2 rounded-lg px-3 py-2 text-xs text-ink", context.onBack ? "bg-warn-bg/60" : "bg-primary-100")}>
          <span className="min-w-0 flex-1">{context.onBack ? "이전 질문의 근거" : "이 답변의 근거"}: <b className="line-clamp-1">{context.query}</b></span>
          {context.onBack && <button type="button" onClick={context.onBack} className="shrink-0 font-medium text-primary-700 hover:underline">최신으로</button>}
        </div>
      )}
      {sources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-ink-muted">답변에 인용된 규정 조항이 여기에 표시됩니다.</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              // 제목을 "·"로 자르지 않는다 — 새 규정 제목에 "·"가 들어 있어("배포·장애 대응 운영지침") 앞 단어만 남았다(#098). 길면 말줄임 + 툴팁
              <button key={s.ref} type="button" onClick={() => onSelect(s.ref)} title={`${s.doc_title} ${s.article_label}`} className={cn("max-w-full truncate rounded-full px-3 py-1.5 text-xs font-medium transition-colors", s.ref === active?.ref ? "bg-primary-700 text-white" : "bg-ref-bg text-ref hover:bg-primary-100")}>
                규정 {s.ref.slice(1)} · {shortArticle(s.article_label)}{s.page != null && ` p.${s.page}`}
              </button>
            ))}
          </div>

          {active && (
            <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">{active.doc_title} {active.version}{current && <span title="답변 시점에 검색 대상인 유효한 판입니다. 폐기·개정된 판은 검색되지 않습니다" className="rounded-full bg-success-bg px-2 py-0.5 font-medium text-success">현재 시행 중</span>}</div>
              <div className="text-base font-bold text-ink">{active.article_label}</div>
              <div ref={bodyRef} className="flex flex-col gap-2">
                {blocks.map((b, i) => b.kind === "table" ? (
                  <div key={i} className="flex flex-col gap-1.5">
                    {firstUsed >= b.at && firstUsed < b.at + b.rows.length && usedBadge("줄")}
                    <PolicyTable head={b.head} rows={b.rows} used={(row) => used.has(b.at + row)} />
                  </div>
                ) : (
                  // 표시한 항이 없으면 지금까지처럼 모두 같은 바탕. 있으면 쓰인 항만 답변 문장과 같은 색, 나머지는 흐리게
                  <p key={i} data-used={used.has(b.at) ? "" : undefined} className={cn("whitespace-pre-line rounded-lg px-3 py-2.5 text-sm leading-relaxed", used.size === 0 ? "bg-primary-50 text-ink" : used.has(b.at) ? "bg-primary-200 text-ink shadow-[inset_3px_0_0_var(--color-primary-700)]" : "text-ink-muted")}>
                    {b.at === firstUsed && <span className="mb-1 block">{usedBadge("항")}</span>}
                    {b.text}
                  </p>
                ))}
              </div>
              {note && <p className="text-xs leading-relaxed text-ink-muted">{note}</p>}
              {active.page != null && <div className="text-xs text-ink-muted">p.{active.page}</div>}
            </div>
          )}
          {/* 원문 전체 보기: onOpenFile 이 규정 원문 창(PolicyDocDialog)을 연다. 지금은 문서의 글 전체를 보여 주고,
              문서가 PDF 로 확정되면 그 창의 본문만 PDF 로 바꾼다 (Tier 2). onOpenFile 을 넘기지 않으면 버튼이 꺼진다 */}
          <Button variant="outline" size="lg" className="h-12 w-full" disabled={!onOpenFile || !active} onClick={() => { if (active) onOpenFile?.(active); }} title="문서 전체에서 이 조문 보기">원문 전체 보기</Button>
        </>
      )}
    </aside>
  );
}