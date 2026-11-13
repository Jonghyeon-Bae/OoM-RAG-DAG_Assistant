"use client";
import { Fragment, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import { deleteDoc, fetchDocChunks, fetchDocEvents, fetchDocs, patchDocStatus } from "@/lib/api/client";
import { UploadsPanel } from "@/components/blocks/documents/UploadsPanel";
import type { DocEvent, DocStatus, PolicyChunk, PolicyDocument, PolicyUpload, SourceType } from "@/lib/types/domain";

// 규정 문서 관리 (백엔드 #37·#44, #109). 탭: 등록된 문서(폐기·복원·삭제·조문·이력) / 올리기·검수(업로드 → 자동 변환 → 검수 → 승인)
// 권한은 서버가 문서마다 can_manage 로 알려 준다 — 화면은 그 값으로 버튼을 숨기기만 한다
const srcLabel: Record<SourceType, string> = { pdf: "PDF", hwp: "HWP", markdown: "Markdown", json: "JSON" };
const actionLabel: Record<string, string> = { uploaded: "등록", indexed: "등록(색인)", superseded: "새 판으로 대체", retired: "폐기", restored: "복원", deleted: "삭제" };
const actionTone: Record<string, "neutral" | "primary" | "warn" | "fail" | "dark"> = { uploaded: "neutral", indexed: "primary", superseded: "dark", retired: "dark", restored: "primary", deleted: "fail" };
export const fmtAt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { year: "2-digit", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");

type Ask = { kind: "retire" | "delete"; id: number; reason: string };
type Panel = { kind: "events"; doc: PolicyDocument | null; items: DocEvent[] } | { kind: "chunks"; doc: PolicyDocument; items: PolicyChunk[] };
type Tab = "docs" | "uploads";

export function DocumentsView({ wsId, initial, initialEvents, initialUploads, canUpload, companyAdmin }: {
  wsId: number; initial: PolicyDocument[]; initialEvents: DocEvent[]; initialUploads: PolicyUpload[]; canUpload: boolean; companyAdmin: boolean;
}) {
  const [tab, setTab] = useState<Tab>("docs");
  const [docs, setDocs] = useState(initial);
  const [filter, setFilter] = useState<DocStatus | "all">("active");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [panel, setPanel] = useState<Panel>({ kind: "events", doc: null, items: initialEvents });
  const [busy, setBusy] = useState<number | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "fail"; text: string } | null>(null);
  const pending = initialUploads.filter((u) => u.status === "review").length;

  // 같은 제목 = 한 규정의 판 묶음 (최신 등록 순)
  const groups = Object.values(docs.reduce<Record<string, PolicyDocument[]>>((acc, d) => ((acc[d.title] ??= []).push(d), acc), {}))
    .map((g) => g.sort((a, b) => (b.indexed_at ?? b.uploaded_at ?? "").localeCompare(a.indexed_at ?? a.uploaded_at ?? "")));
  const counts = { all: docs.length, active: docs.filter((d) => d.status === "active").length, retired: docs.filter((d) => d.status === "retired").length };
  const titleOf = (id: number | null) => docs.find((d) => d.id === id)?.version;

  const refresh = async () => {
    const [d, e] = await Promise.all([fetchDocs(wsId), fetchDocEvents(wsId)]);
    setDocs(d);
    setPanel({ kind: "events", doc: null, items: e });
  };
  async function run(id: number, fn: () => Promise<{ ok: true } | { ok: false; message: string }>, done: string) {
    setBusy(id); setMsg(null);
    const r = await fn();
    setBusy(null); setAsk(null);
    if (!r.ok) { setMsg({ tone: "fail", text: r.message }); return; }
    setMsg({ tone: "ok", text: done });
    await refresh();
  }
  const restore = (d: PolicyDocument) => run(d.id, () => patchDocStatus(wsId, d.id, "active"), `${d.title} ${d.version} 복원 — 다시 검색됩니다`);
  const retire = (d: PolicyDocument, reason: string) => run(d.id, () => patchDocStatus(wsId, d.id, "retired", reason), `${d.title} ${d.version} 폐기 — 검색에서 빠집니다`);
  const remove = (d: PolicyDocument) => run(d.id, () => deleteDoc(wsId, d.id), `${d.title} ${d.version} 영구 삭제`);
  const showChunks = async (doc: PolicyDocument) => { setBusy(doc.id); setPanel({ kind: "chunks", doc, items: await fetchDocChunks(wsId, doc.id) }); setBusy(null); };
  const showEvents = async (doc: PolicyDocument | null) => { setBusy(doc?.id ?? 0); setPanel({ kind: "events", doc, items: await fetchDocEvents(wsId, doc?.id) }); setBusy(null); };

  return (
    <main className="flex flex-col gap-4 p-3 sm:gap-6 md:p-6 xl:p-8">
      <div role="tablist" className="flex gap-1 border-b border-border">
        {([["docs", `등록된 문서 ${counts.active}`], ["uploads", `올리기·검수${pending ? ` · 검수 대기 ${pending}` : ""}`]] as const).map(([id, label]) => (
          <button key={id} role="tab" type="button" aria-selected={tab === id} onClick={() => setTab(id)}
            className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium pointer-coarse:min-h-11", tab === id ? "border-primary-700 text-primary-700" : "border-transparent text-ink-muted hover:text-ink")}>{label}</button>
        ))}
      </div>

      {tab === "uploads" ? (
        <UploadsPanel wsId={wsId} initial={initialUploads} docs={docs} canUpload={canUpload} companyAdmin={companyAdmin} onApproved={refresh} />
      ) : (
        <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="flex min-w-0 flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {(["active", "retired", "all"] as const).map((k) => (
                <button key={k} type="button" onClick={() => setFilter(k)} className={cn("rounded-full px-3 py-1 text-sm pointer-coarse:min-h-11 pointer-coarse:px-4", filter === k ? "bg-primary-700 text-white" : "bg-primary-50 text-ink-muted hover:bg-primary-100")}>
                  {{ all: "전체", active: "사용 중", retired: "폐기" }[k]} {counts[k]}
                </button>
              ))}
              <span className="text-xs text-ink-muted">이 부서와 전사 공통 규정. 어시스턴트는 &ldquo;사용 중&rdquo;만 검색합니다.</span>
            </div>
            {msg && <p role="status" className={cn("rounded-lg px-3 py-2 text-sm", msg.tone === "ok" ? "bg-primary-50 text-ink" : "bg-fail-bg text-fail")}>{msg.text}</p>}

            {groups.map((g) => {
              const rows = g.filter((d) => filter === "all" || d.status === filter);
              if (!rows.length) return null;
              const activeCount = g.filter((d) => d.status === "active").length;
              return (
                <Card key={g[0].title} className="min-w-0 gap-0 p-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 sm:px-5">
                    <h2 className="font-semibold text-ink">{g[0].title}</h2>
                    <span className="text-xs text-ink-muted">판 {g.length}개 · 사용 중 {activeCount}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {rows.map((d) => {
                      const retired = d.status === "retired";
                      const asking = ask?.id === d.id ? ask : null;
                      return (
                        <Fragment key={d.id}>
                          <li className={cn("flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5", panel.doc?.id === d.id && "bg-primary-50/60")}>
                            <div className="min-w-0 flex-1">
                              <div className={cn("flex flex-wrap items-center gap-1.5 text-sm", retired ? "text-ink-muted" : "text-ink")}>
                                <span className="font-semibold">{d.version}</span>
                                {retired
                                  ? <Chip tone="dark" className="h-5 text-xs" title={[d.retired_by && `처리: ${d.retired_by}`, d.retire_reason && `사유: ${d.retire_reason}`].filter(Boolean).join(" / ") || undefined}>폐기 · {fmtAt(d.retired_at)}</Chip>
                                  : <Chip tone="primary" className="h-5 text-xs">사용 중</Chip>}
                                {d.superseded_by && <Chip tone="neutral" className="h-5 text-xs">새 판 {titleOf(d.superseded_by) ?? ""}으로 대체됨</Chip>}
                                {d.visibility === "company" && <Chip tone="primary" className="h-5 text-xs" title="전사 공통 규정">전사</Chip>}
                                <Chip tone="neutral" className="h-5 text-xs">{srcLabel[d.source_type] ?? d.source_type}</Chip>
                                {d.doc_type && <span className="text-xs text-ink-muted">{d.doc_type}</span>}
                              </div>
                              <div className="mt-0.5 text-xs text-ink-muted">
                                조문 {d.chunk_count}조각 · 등록 {fmtAt(d.indexed_at ?? d.uploaded_at)}{d.uploaded_by && ` · ${d.uploaded_by}`}{d.approved_by && ` · 검수 ${d.approved_by}`}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1 sm:justify-end">
                              <Button size="xs" variant="ghost" disabled={busy === d.id} onClick={() => showChunks(d)}>조문</Button>
                              <Button size="xs" variant="ghost" disabled={busy === d.id} onClick={() => showEvents(d)}>이력</Button>
                              {d.can_manage && (retired ? (
                                <>
                                  <Button size="xs" variant="ghost" disabled={busy === d.id || !!d.superseded_by} title={d.superseded_by ? "새 판으로 대체된 문서는 복원할 수 없습니다" : undefined} onClick={() => restore(d)}>복원</Button>
                                  <Button size="xs" variant="ghost" className="text-fail" disabled={busy === d.id} onClick={() => setAsk({ kind: "delete", id: d.id, reason: "" })}>삭제</Button>
                                </>
                              ) : (
                                <Button size="xs" variant="ghost" disabled={busy === d.id} onClick={() => setAsk({ kind: "retire", id: d.id, reason: "" })}>폐기</Button>
                              ))}
                            </div>
                          </li>
                          {asking && (
                            <li className="bg-warn-bg/50 px-4 py-3 sm:px-5">
                              {asking.kind === "retire" ? (
                                <form className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center" onSubmit={(e) => { e.preventDefault(); if (asking.reason.trim()) retire(d, asking.reason.trim()); }}>
                                  <span className="text-sm">{activeCount === 1 ? <b className="text-fail">이 규정의 마지막 사용 중 판입니다 — 폐기하면 이 규정 전체가 검색에서 빠집니다.</b> : "폐기하면 어시스턴트 검색에서 빠집니다."} 사유:</span>
                                  <input autoFocus value={asking.reason} onChange={(e) => setAsk({ ...asking, reason: e.target.value })} maxLength={300} placeholder="예: 2027-01 개정판으로 교체" className="h-9 min-w-0 flex-1 rounded-md border bg-white px-2 text-sm pointer-coarse:h-11" />
                                  <div className="flex gap-2">
                                    <Button size="xs" type="submit" disabled={!asking.reason.trim() || busy === d.id}>폐기</Button>
                                    <Button size="xs" type="button" variant="ghost" onClick={() => setAsk(null)}>취소</Button>
                                  </div>
                                </form>
                              ) : (
                                <div className="flex flex-col gap-2 text-sm sm:flex-row sm:flex-wrap sm:items-center">
                                  <span>&ldquo;{d.title} {d.version}&rdquo;과 조문 {d.chunk_count}조각을 영구 삭제합니다. 되돌릴 수 없습니다. 이 문서를 근거로 적은 사례가 있으면 서버가 막습니다.</span>
                                  <div className="flex gap-2">
                                    <Button size="xs" className="bg-fail text-white hover:bg-fail/90" disabled={busy === d.id} onClick={() => remove(d)}>영구 삭제</Button>
                                    <Button size="xs" variant="ghost" onClick={() => setAsk(null)}>취소</Button>
                                  </div>
                                </div>
                              )}
                            </li>
                          )}
                        </Fragment>
                      );
                    })}
                  </ul>
                </Card>
              );
            })}
            {!docs.length && <Card className="p-8 text-center text-sm text-ink-muted">등록된 규정 문서가 없습니다.{canUpload && " “올리기·검수” 탭에서 규정 파일을 올릴 수 있습니다."}</Card>}
          </section>

          <aside className="min-w-0">
            <Card className="gap-3 p-4 sm:p-5 lg:sticky lg:top-24">
              {panel.kind === "chunks" ? (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-ink">조문</h3>
                    <Button size="xs" variant="ghost" onClick={() => showEvents(null)}>변경 이력으로</Button>
                  </div>
                  <p className="text-xs text-ink-muted">{panel.doc.title} {panel.doc.version} · {panel.items.length}조각. 조각 ID는 어시스턴트 답변의 출처 표기와 같습니다.</p>
                  <ul className="max-h-[70vh] space-y-2 overflow-auto">
                    {panel.items.map((c) => (
                      <li key={c.id} className="rounded-lg border bg-white p-3 text-sm">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-1 text-xs text-ink-muted"><span>{c.article_label}{c.page != null && ` · p.${c.page}`}</span><span className="font-mono">{c.id}</span></div>
                        <p className="whitespace-pre-line leading-relaxed text-ink">{c.text}</p>
                      </li>
                    ))}
                    {!panel.items.length && <li className="text-sm text-ink-muted">조문이 없습니다.</li>}
                  </ul>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-ink">{panel.doc ? "문서 이력" : "최근 변경 이력"}</h3>
                    {panel.doc && <Button size="xs" variant="ghost" onClick={() => showEvents(null)}>전체 보기</Button>}
                  </div>
                  <p className="text-xs text-ink-muted">{panel.doc ? `${panel.doc.title} ${panel.doc.version}` : "등록·개정 대체·폐기·복원·삭제 기록. 삭제된 문서의 기록도 남습니다."}</p>
                  <ol className="max-h-[70vh] space-y-2 overflow-auto">
                    {panel.items.map((e) => (
                      <li key={e.id} className="rounded-lg border bg-white p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <Chip tone={actionTone[e.action] ?? "neutral"} className="h-5 text-xs">{actionLabel[e.action] ?? e.action}</Chip>
                          <span className="text-xs tabular-nums text-ink-muted">{fmtAt(e.at)}</span>
                        </div>
                        {!panel.doc && e.document_label && <div className="mt-1 font-medium text-ink">{e.document_label}</div>}
                        <div className="mt-1 text-xs text-ink-muted">{e.actor} · {e.source === "ui" ? "화면" : "스크립트"}{e.reason && ` · ${e.reason}`}</div>
                      </li>
                    ))}
                    {!panel.items.length && <li className="text-sm text-ink-muted">기록이 없습니다.</li>}
                  </ol>
                </>
              )}
            </Card>
          </aside>
        </div>
      )}
    </main>
  );
}
