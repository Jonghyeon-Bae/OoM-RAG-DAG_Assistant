"use client";
import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PolicyTable } from "@/components/blocks/PolicyTable";
import { PolicyDocDialog } from "@/components/blocks/PolicyDocDialog";
import { putPolicyRefs } from "@/lib/api/client";
import { policyBlocks } from "@/lib/policyText";
import { relationLabel } from "@/lib/relation";
import type { NodePolicyRef } from "@/lib/types/domain";

// 기록 카드의 근거 조문 배지를 누르면 뜨는 창 (백엔드 제안 7.3): 그 조문의 원문(article_text) · 문서 전체 보기 ·
// 개정으로 대응 조문이 없어진 경우(revision = replaced) 제안 조문으로 다시 연결(PUT /logs/{id}/policy-refs — 목록을 통째로 바꾼다)
export function PolicyArticleDialog({ nodeId, refs, index, open, onClose }: { nodeId: number; refs: NodePolicyRef[]; index: number; open: boolean; onClose: () => void }) {
  const { wsId } = useParams<{ wsId: string }>();
  const router = useRouter();
  const p = refs[index];
  const [full, setFull] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  if (!p) return null;
  const name = [p.doc_title, p.version, p.article_label].filter(Boolean).join(" ") || p.from_label || p.topic || "근거 조문";
  const canRelink = p.revision === "replaced" && !!p.suggested_policy && !!p.suggested_article;
  const relink = async () => {
    setBusy(true); setMsg(null);
    const r = await putPolicyRefs(Number(wsId), nodeId, refs.map((x, i) => ({
      relation: x.relation, note: x.note ?? undefined, topic: x.topic ?? undefined,
      policy: (i === index ? x.suggested_policy : x.policy) ?? undefined, article: (i === index ? x.suggested_article : x.article) ?? undefined,
    })));
    setBusy(false);
    if (!r.ok) { setMsg({ text: r.message, ok: false }); return; }
    setMsg({ text: "다시 연결했습니다. 화면을 새로 고치면 카드에 반영됩니다.", ok: true });
    router.refresh();
  };
  return (
    <>
      <Dialog.Root open={open && !full} onOpenChange={(next) => { if (!next) onClose(); }}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-ink/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col rounded-t-2xl bg-card shadow-xl outline-none lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[42rem] lg:max-w-[90vw] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-2xl">
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-border px-4 py-3 lg:px-6">
              <div className="min-w-0">
                <Dialog.Title className="text-base font-bold text-ink">{name}</Dialog.Title>
                <Dialog.Description className="text-xs text-ink-muted">이 기록이 근거로 적은 조문 — {relationLabel[p.relation]}{p.page != null && ` · ${p.page}쪽`}</Dialog.Description>
              </div>
              <Dialog.Close aria-label="닫기" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-ink hover:bg-primary-100"><X className="size-5" /></Dialog.Close>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4 lg:px-6">
              {p.note && <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-ink"><span className="text-xs font-semibold text-ink-muted">기록에 적은 메모</span><br />{p.note}</p>}
              {p.revision === "amended" && <p className="rounded-lg bg-warn-bg/60 px-3 py-2 text-xs text-ink">규정이 개정되어 조문 내용이 바뀌었습니다. 이 기록은 개정 전 기준({p.from_label ?? "이전 판"})으로 처리한 건입니다. 아래는 지금 유효한 조문입니다.</p>}
              {p.revision === "replaced" && (
                <div className="flex flex-col gap-2 rounded-lg bg-warn-bg/60 px-3 py-2 text-xs text-ink">
                  <span>규정이 개정되면서 이 기록이 따른 조문({p.from_label ?? "이전 판"})에 대응하는 조문이 정해지지 않았습니다. 근거 조문을 다시 연결해야 합니다.</span>
                  {canRelink ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <span>내용이 가장 가까운 새 조문(제안): <b>{p.suggested_label}</b></span>
                      <Button size="xs" disabled={busy || msg?.ok} onClick={relink}>이 조문으로 다시 연결</Button>
                    </div>
                  ) : <span className="text-ink-muted">제안할 조문이 없습니다. 기록을 고쳐 근거 조문을 직접 다시 고르세요.</span>}
                </div>
              )}
              {msg && <p role="status" className={msg.ok ? "text-xs text-success" : "text-xs text-fail"}>{msg.text}</p>}
              {p.article_text ? policyBlocks(p.article_text, true).map((b, j) => b.kind === "table" ? (
                <div key={j}><PolicyTable head={b.head} rows={b.rows} /></div>
              ) : (
                <p key={j} className="whitespace-pre-line text-sm leading-relaxed text-ink">{b.text}</p>
              )) : p.revision !== "replaced" && <p className="text-sm text-ink-muted">{p.relation === "gap" ? `기준이 없다고 적은 건입니다${p.topic ? ` — ${p.topic}` : ""}.` : "지금 유효한 조문 원문이 없습니다(문서가 폐기되었을 수 있습니다)."}</p>}
            </div>
            {p.document_id != null && (
              <div className="shrink-0 border-t border-border px-4 py-3 lg:px-6"><Button size="sm" variant="outline" onClick={() => setFull(true)}>문서 전체 보기</Button></div>
            )}
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
      {p.document_id != null && (
        <PolicyDocDialog wsId={Number(wsId)} open={open && full} onClose={() => { setFull(false); onClose(); }} hitLabel="이 기록이 근거로 적은 조문" description="규정 원문 전체입니다. 이 기록이 근거로 적은 조문을 노란색으로 표시했습니다."
          source={{ ref: "", chunk_id: "", doc_id: p.document_id, doc_title: p.doc_title ?? "", version: p.version ?? "", article_label: p.article_label ?? "", page: p.page ?? null, text: "" }} />
      )}
    </>
  );
}
