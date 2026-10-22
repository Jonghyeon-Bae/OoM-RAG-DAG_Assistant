"use client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import type { PolicyRef } from "@/lib/types/domain";

// JSON 근거 카드 (03 안건 A). 청크 텍스트를 ①②③ 항 단위로 쪼개 전부 하이라이트. react-pdf 원문은 Tier 2.
export function SourceViewer({ sources, activeRef, onSelect }: { sources: PolicyRef[]; activeRef: string | null; onSelect: (ref: string) => void }) {
  const active = sources.find((s) => s.ref === activeRef) ?? sources[0];
  const clauses = active ? active.text.split(/(?=[①②③④⑤⑥⑦⑧⑨])/).map((s) => s.trim()).filter(Boolean) : [];

  return (
    <aside className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-ink">출처 원문 뷰어</h2>
        <Chip tone="primary" className="text-[11px]">근거 하이라이트</Chip>
      </div>

      {sources.length === 0 ? (
        <Card className="p-5 text-sm text-ink-muted">답변에 인용된 규정 조항이 여기에 표시됩니다.</Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {sources.map((s) => (
              <button key={s.ref} type="button" onClick={() => onSelect(s.ref)} className={cn("rounded-full px-3 py-1.5 text-xs font-medium transition-colors", s.ref === active?.ref ? "bg-primary-700 text-white" : "bg-ref-bg text-ref hover:bg-primary-100")}>
                [{s.ref}] {s.doc_title.split("·")[0]} p.{s.page}
              </button>
            ))}
          </div>

          {active && (
            <Card className="gap-3 p-5">
              <div className="text-xs text-ink-muted">{active.doc_title} {active.version}</div>
              <div className="text-base font-bold text-ink">{active.article_label}</div>
              <div className="flex flex-col gap-2">
                {clauses.map((c, i) => (
                  <p key={i} className="rounded-lg bg-primary-50 px-3 py-2.5 text-sm leading-relaxed text-ink">{c}</p>
                ))}
              </div>
              <div className="text-xs text-ink-muted">p.{active.page}</div>
            </Card>
          )}
          {/* TODO Tier 2: GET /api/documents/{doc_id}/file → react-pdf 모달 */}
          <Button variant="outline" size="lg" className="h-12 w-full" disabled title="Tier 2 — react-pdf 원문 보기">원문 전체 보기</Button>
        </>
      )}
    </aside>
  );
}