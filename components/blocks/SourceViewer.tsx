"use client";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import type { PolicyRef } from "@/lib/types/domain";
import { shortArticle } from "@/lib/article";

// JSON 근거 카드 (03 안건 A). 청크 텍스트를 ①②③ 항 단위로 쪼개 전부 하이라이트. react-pdf 원문은 Tier 2.
export function SourceViewer({ sources, activeRef, onSelect, context, current }: { sources: PolicyRef[]; activeRef: string | null; onSelect: (ref: string) => void; context?: { query: string; onBack?: () => void }; current?: boolean }) {
  const active = sources.find((s) => s.ref === activeRef) ?? sources[0];
  const clauses = active ? active.text.split(/(?=[①②③④⑤⑥⑦⑧⑨])/).map((s) => s.trim()).filter(Boolean) : [];

  return (
    // 오른쪽 패널: 흰 바탕 + 테두리 + 왼쪽 강조선으로 대화 영역과 구분, 스크롤해도 따라오게 sticky
    <aside className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto overflow-y-auto rounded-2xl border border-border border-l-4 border-l-primary-700 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="font-bold text-ink">규정 원문</h2>
        <Chip tone="primary" className="text-xs" title="답변에 인용된 조항을 항 단위로 보여줍니다">인용된 조항</Chip>
      </div>

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
              <div className="flex flex-col gap-2">
                {clauses.map((c, i) => (
                  <p key={i} className="rounded-lg bg-primary-50 px-3 py-2.5 text-sm leading-relaxed text-ink">{c}</p>
                ))}
              </div>
              {active.page != null && <div className="text-xs text-ink-muted">p.{active.page}</div>}
            </div>
          )}
          {/* TODO Tier 2: GET /api/documents/{doc_id}/file → react-pdf 모달 */}
          <Button variant="outline" size="lg" className="h-12 w-full" disabled title="Tier 2 — react-pdf 원문 보기">원문 전체 보기</Button>
        </>
      )}
    </aside>
  );
}