"use client";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import type { PolicyRef } from "@/lib/types/domain";

// JSON 근거 카드 (03 안건 A). 청크 텍스트를 ①②③ 항 단위로 쪼개 전부 하이라이트. react-pdf 원문은 Tier 2.
export function SourceViewer({ sources, activeRef, onSelect }: { sources: PolicyRef[]; activeRef: string | null; onSelect: (ref: string) => void }) {
  const active = sources.find((s) => s.ref === activeRef) ?? sources[0];
  const clauses = active ? active.text.split(/(?=[①②③④⑤⑥⑦⑧⑨])/).map((s) => s.trim()).filter(Boolean) : [];

  return (
    // 오른쪽 패널: 흰 바탕 + 테두리 + 왼쪽 강조선으로 대화 영역과 구분, 스크롤해도 따라오게 sticky
    <aside className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto overflow-y-auto rounded-2xl border border-border border-l-4 border-l-primary-700 bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <h2 className="font-bold text-ink">규정 원문</h2>
        <Chip tone="primary" className="text-[11px]" title="답변에 인용된 조항을 항 단위로 보여줍니다">인용된 조항</Chip>
      </div>

      {sources.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-ink-muted">답변에 인용된 규정 조항이 여기에 표시됩니다.</div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <button key={s.ref} type="button" onClick={() => onSelect(s.ref)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors", s.ref === active?.ref ? "bg-primary-700 text-white" : "bg-ref-bg text-ref hover:bg-primary-100")}>
                규정 {s.ref.slice(1)} · {s.doc_title.split("·")[0]} p.{s.page}
              </button>
            ))}
          </div>

          {active && (
            <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
              <div className="text-xs text-ink-muted">{active.doc_title} {active.version}</div>
              <div className="text-base font-bold text-ink">{active.article_label}</div>
              <div className="flex flex-col gap-2">
                {clauses.map((c, i) => (
                  <p key={i} className="rounded-lg bg-primary-50 px-3 py-2.5 text-sm leading-relaxed text-ink">{c}</p>
                ))}
              </div>
              <div className="text-xs text-ink-muted">p.{active.page}</div>
            </div>
          )}
          {/* TODO Tier 2: GET /api/documents/{doc_id}/file → react-pdf 모달 */}
          <Button variant="outline" size="lg" className="h-12 w-full" disabled title="Tier 2 — react-pdf 원문 보기">원문 전체 보기</Button>
        </>
      )}
    </aside>
  );
}