"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/components/ui";
import { fetchDocChunks } from "@/lib/api/client";
import { PolicyTable } from "@/components/blocks/PolicyTable";
import { isFirstPiece, policyBlocks } from "@/lib/policyText";
import type { PolicyChunk, PolicyRef } from "@/lib/types/domain";

// 규정 원문 창 (폰·PC 공통): 뒤 화면을 반투명으로 가리고, 문서 전체를 조문 순서대로 펼친다.
// 답변에 쓰인 조문은 반투명 노란색으로 칠하고 그 위치로 바로 이동한다.
// 지금은 문서의 글 조각(GET /documents/{id}/chunks)으로 그린다. 문서가 PDF 로 확정되면 DocBody 만 PDF 뷰어로 바꾸면 된다(창 · 제목 · 닫기는 그대로).
// hitLabel · description = 답변이 아닌 곳(기록 카드의 근거 조문)에서 열 때의 문구
export function PolicyDocDialog({ wsId, source, open, onClose, hitLabel, description }: { wsId: number; source: PolicyRef | null; open: boolean; onClose: () => void; hitLabel?: string; description?: string }) {
  return (
    <Dialog.Root open={open && !!source} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-ink/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex h-[92dvh] flex-col rounded-t-2xl bg-card shadow-xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 max-lg:data-[ending-style]:translate-y-full max-lg:data-[starting-style]:translate-y-full lg:bottom-auto lg:top-[4dvh] lg:mx-auto lg:w-full lg:max-w-4xl lg:rounded-2xl">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3 lg:px-6">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-bold text-ink">{source ? `${source.doc_title} ${source.version}` : "규정 원문"}</Dialog.Title>
              <Dialog.Description className="text-xs text-ink-muted">{description ?? "규정 원문 전체입니다. 답변에 쓰인 조문을 노란색으로 표시했습니다."}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="닫기" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-ink hover:bg-primary-100"><X className="size-5" /></Dialog.Close>
          </div>
          {source && <DocBody key={`${source.doc_id}-${source.chunk_id}`} wsId={wsId} source={source} hitLabel={hitLabel} />}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// 문서 본문. PDF 로 바꿀 때 이 컴포넌트만 교체한다
function DocBody({ wsId, source, hitLabel }: { wsId: number; source: PolicyRef; hitLabel?: string }) {
  const [chunks, setChunks] = useState<PolicyChunk[] | null>(null); // null = 불러오는 중
  const markRef = useRef<HTMLElement>(null);
  useEffect(() => {
    let alive = true;
    fetchDocChunks(wsId, source.doc_id).then((list) => { if (alive) setChunks(list); });
    return () => { alive = false; };
  }, [wsId, source.doc_id]);
  // 다 받으면 표시한 조문이 화면 가운데 오게
  useEffect(() => { if (chunks?.length) markRef.current?.scrollIntoView({ block: "center" }); }, [chunks]);

  if (chunks === null) return <p className="px-6 py-10 text-center text-sm text-ink-muted">원문을 불러오는 중…</p>;
  if (chunks.length === 0) return <p className="px-6 py-10 text-center text-sm text-ink-muted">원문을 불러오지 못했습니다. 문서가 폐기되었거나 볼 권한이 없을 수 있습니다.</p>;

  // 답변에 쓰인 조문: 같은 조각이거나, 한 조문이 여러 조각으로 나뉜 경우 같은 조문 이름
  const isHit = (c: PolicyChunk) => c.id === source.chunk_id || c.article_label === source.article_label;
  const first = chunks.findIndex(isHit);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-primary-50 px-3 py-4 lg:px-6">
      <article className="mx-auto flex max-w-3xl flex-col gap-1 rounded-xl bg-card px-4 py-5 shadow-sm lg:px-10 lg:py-8">
        {chunks.map((c, i) => {
          const hit = isHit(c);
          return (
            <section key={c.id} ref={i === first ? markRef : undefined} className={cn("rounded-lg px-3 py-2", hit && "bg-yellow-300/35 shadow-[inset_3px_0_0_var(--color-warn)]")}>
              {i === first && <span className="mb-1 inline-block rounded-full bg-primary-700 px-2 py-0.5 text-xs font-semibold text-white">{hitLabel ?? `규정 ${source.ref.slice(1)} · 답변에 쓰인 조문`}</span>}
              {c.article_label !== chunks[i - 1]?.article_label && <h3 className="text-sm font-bold text-ink">{c.article_label}</h3>}
              {/* 글은 ①②③ 항마다 한 문단, 표("| 칸 |" 줄)는 표로 */}
              {policyBlocks(c.text, isFirstPiece(c.id)).map((b, j) => b.kind === "table" ? (
                <div key={j} className="my-1.5"><PolicyTable head={b.head} rows={b.rows} /></div>
              ) : (
                <p key={j} className="whitespace-pre-line text-sm leading-relaxed text-ink">{b.text}</p>
              ))}
            </section>
          );
        })}
      </article>
    </div>
  );
}