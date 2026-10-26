"use client";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import { deleteDoc, fetchDocChunks, fetchDocEvents, patchDocStatus } from "@/lib/api/client";
import type { DocEvent, DocEventAction, DocStatus, PolicyChunk, PolicyDocument, SourceType } from "@/lib/types/domain";

const srcLabel: Record<SourceType, string> = { pdf: "PDF", hwp: "HWP", markdown: "Markdown", json: "JSON" };
const actionLabel: Record<DocEventAction, string> = { uploaded: "등록", indexed: "인덱싱", superseded: "개정으로 폐기", retired: "폐기", restored: "복원", deleted: "삭제" };
const actionTone: Record<DocEventAction, "neutral" | "primary" | "warn" | "fail" | "dark"> = { uploaded: "neutral", indexed: "primary", superseded: "dark", retired: "dark", restored: "primary", deleted: "fail" };
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");

type Ask = { kind: "retire" | "delete"; id: number; reason: string };
type Panel = { kind: "events"; doc: PolicyDocument | null; items: DocEvent[] } | { kind: "chunks"; doc: PolicyDocument; items: PolicyChunk[] };

export function DocumentsView({ wsId, initial, initialEvents }: { wsId: number; initial: PolicyDocument[]; initialEvents: DocEvent[] }) {
  const [docs, setDocs] = useState(initial);
  const [filter, setFilter] = useState<DocStatus | "all">("all");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [panel, setPanel] = useState<Panel>({ kind: "events", doc: null, items: initialEvents });
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 같은 제목 = 한 규정의 버전 묶음 (최신 인덱싱 순)
  const groups = Object.values(
    docs.reduce<Record<string, PolicyDocument[]>>((acc, d) => ((acc[d.title] ??= []).push(d), acc), {}),
  ).map((g) => g.sort((a, b) => b.indexed_at.localeCompare(a.indexed_at)));

  const counts = { all: docs.length, active: docs.filter((d) => d.status === "active").length, retired: docs.filter((d) => d.status === "retired").length };

  // 상태 변경 뒤에는 이력 패널을 전체 최신으로 갱신해 방금 한 일이 바로 보이게 한다
  async function run(id: number, fn: () => Promise<void>, refreshEvents = true) {
    setBusy(id); setError(null);
    try {
      await fn();
      if (refreshEvents) setPanel({ kind: "events", doc: null, items: await fetchDocEvents(wsId) });
    } catch (e) { setError(e instanceof Error ? e.message : "처리에 실패했습니다"); } finally { setBusy(null); setAsk(null); }
  }
  const restore = (id: number) => run(id, async () => { const d = await patchDocStatus(wsId, id, "active"); if (d) setDocs((p) => p.map((x) => (x.id === id ? d : x))); });
  const retire = (id: number, reason: string) => run(id, async () => { const d = await patchDocStatus(wsId, id, "retired", reason); if (d) setDocs((p) => p.map((x) => (x.id === id ? d : x))); });
  const remove = (id: number) => run(id, async () => { const r = await deleteDoc(wsId, id); if (!r.ok) throw new Error(r.message ?? "삭제 실패"); setDocs((p) => p.filter((x) => x.id !== id)); });
  const showChunks = (doc: PolicyDocument) => run(doc.id, async () => setPanel({ kind: "chunks", doc, items: await fetchDocChunks(wsId, doc.id) }), false);
  const showEvents = (doc: PolicyDocument | null) => run(doc?.id ?? 0, async () => setPanel({ kind: "events", doc, items: await fetchDocEvents(wsId, doc?.id) }), false);

  return (
    <main className="grid gap-6 p-8 xl:grid-cols-[1fr_380px]">
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1">
            {(["all", "active", "retired"] as const).map((k) => (
              <button key={k} type="button" onClick={() => setFilter(k)} className={cn("rounded-full px-3 py-1 text-sm", filter === k ? "bg-primary text-white" : "bg-primary-50 text-ink-muted hover:bg-primary-100")}>
                {{ all: "전체", active: "사용 중", retired: "폐기" }[k]} {counts[k]}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-muted">문서 추가·재인덱싱은 관리자 스크립트로 수행합니다. 이 화면은 상태 변경과 폐기 문서 삭제만 지원합니다.</p>
        </div>
        {error && <p className="rounded-card bg-fail-bg px-3 py-2 text-sm text-fail">{error}</p>}

        {groups.map((g) => {
          const rows = g.filter((d) => filter === "all" || d.status === filter);
          if (!rows.length) return null;
          return (
            <Card key={g[0].title} className="gap-0 p-0">
              <div className="flex items-center justify-between border-b px-5 py-3">
                <h2 className="font-semibold text-ink">{g[0].title}</h2>
                <span className="text-xs text-ink-muted">버전 {g.length}개 · 사용 중 {g.filter((d) => d.status === "active").length}</span>
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-ink-muted">
                  <tr className="[&>th]:px-5 [&>th]:py-2 [&>th]:font-medium">
                    <th>버전</th><th>원천</th><th>상태</th><th className="text-right">청크</th><th>인덱싱 · 등록자</th><th className="text-right">작업</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => {
                    const retired = d.status === "retired";
                    const asking = ask?.id === d.id ? ask : null;
                    return (
                      <RowGroup key={d.id}>
                        <tr className={cn("border-t [&>td]:px-5 [&>td]:py-3", retired && "text-ink-muted", panel.doc?.id === d.id && "bg-primary-50/60")}>
                          <td className="font-medium text-ink">{d.version}</td>
                          <td><Chip tone="neutral" className="h-5 text-[11px]">{srcLabel[d.source_type]}</Chip> {d.visibility === "company" && <Chip tone="primary" className="h-5 text-[11px]" title="전사 공통 규정">전사</Chip>}</td>
                          <td>{retired ? <Chip tone="dark" className="h-5 text-[11px]" title={[d.retired_by && `처리: ${d.retired_by}`, d.retire_reason && `사유: ${d.retire_reason}`].filter(Boolean).join(" / ") || undefined}>폐기 · {fmt(d.retired_at)}</Chip> : <Chip tone="primary" className="h-5 text-[11px]">사용 중</Chip>}</td>
                          <td className="text-right tabular-nums">{d.chunk_count}</td>
                          <td className="tabular-nums" title={`등록: ${d.uploaded_by} · ${fmt(d.uploaded_at)}`}>{fmt(d.indexed_at)}<span className="ml-1 text-xs text-ink-muted">{d.uploaded_by}</span></td>
                          <td>
                            <div className="flex justify-end gap-1">
                              <Button size="xs" variant="ghost" disabled={busy === d.id} onClick={() => showEvents(d)}>이력</Button>
                              {d.has_file ? (
                                <Button size="xs" variant="ghost" disabled title="원문 다운로드는 실서버(GET /api/documents/{id}/file) 연결 후 활성화">원문</Button>
                              ) : (
                                <Button size="xs" variant="ghost" disabled={busy === d.id} onClick={() => showChunks(d)}>청크 보기</Button>
                              )}
                              {retired ? (
                                <>
                                  <Button size="xs" variant="ghost" disabled={busy === d.id} onClick={() => restore(d.id)}>복원</Button>
                                  <Button size="xs" variant="ghost" className="text-fail" disabled={busy === d.id} onClick={() => setAsk({ kind: "delete", id: d.id, reason: "" })}>삭제</Button>
                                </>
                              ) : (
                                <Button size="xs" variant="ghost" disabled={busy === d.id} onClick={() => setAsk({ kind: "retire", id: d.id, reason: "" })}>폐기</Button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {asking && (
                          <tr className="bg-warn-bg/50">
                            <td colSpan={6} className="px-5 py-3">
                              {asking.kind === "retire" ? (
                                <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (asking.reason.trim()) retire(d.id, asking.reason.trim()); }}>
                                  <span className="text-sm">폐기하면 어시스턴트 검색에서 제외됩니다. 사유:</span>
                                  <input autoFocus value={asking.reason} onChange={(e) => setAsk({ ...asking, reason: e.target.value })} placeholder="예: v2.2 개정" className="h-8 min-w-56 rounded-md border bg-white px-2 text-sm" />
                                  <Button size="xs" type="submit" disabled={!asking.reason.trim() || busy === d.id}>폐기</Button>
                                  <Button size="xs" type="button" variant="ghost" onClick={() => setAsk(null)}>취소</Button>
                                </form>
                              ) : (
                                <div className="flex flex-wrap items-center gap-2 text-sm">
                                  <span>&ldquo;{d.title} {d.version}&rdquo;과 청크 {d.chunk_count}개를 영구 삭제합니다. 되돌릴 수 없습니다.</span>
                                  <Button size="xs" className="bg-fail text-white hover:bg-fail/90" disabled={busy === d.id} onClick={() => remove(d.id)}>영구 삭제</Button>
                                  <Button size="xs" variant="ghost" onClick={() => setAsk(null)}>취소</Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </RowGroup>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          );
        })}
        {!docs.length && <Card className="p-8 text-center text-sm text-ink-muted">인덱싱된 규정 문서가 없습니다.</Card>}
      </section>

      <aside>
        <Card className="sticky top-6 gap-3 p-5">
          {panel.kind === "chunks" ? (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink">청크 미리보기</h3>
                <Button size="xs" variant="ghost" onClick={() => showEvents(null)}>변경 이력으로</Button>
              </div>
              <p className="text-xs text-ink-muted">{panel.doc.title} {panel.doc.version} · {panel.items.length}개 표시 (전체 {panel.doc.chunk_count}). 청크 ID는 어시스턴트 답변의 출처 표기와 같습니다.</p>
              <ul className="max-h-[70vh] space-y-2 overflow-auto">
                {panel.items.map((c) => (
                  <li key={c.id} className="rounded-card border bg-white p-3 text-sm">
                    <div className="mb-1 flex items-center justify-between text-[11px] text-ink-muted"><span>{c.article_label}</span><span className="font-mono">{c.id}</span></div>
                    <p className="leading-relaxed text-ink">{c.text}</p>
                  </li>
                ))}
                {!panel.items.length && <li className="text-sm text-ink-muted">샘플 청크가 없습니다.</li>}
              </ul>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-ink">{panel.doc ? "문서 이력" : "최근 변경 이력"}</h3>
                {panel.doc && <Button size="xs" variant="ghost" onClick={() => showEvents(null)}>전체 보기</Button>}
              </div>
              <p className="text-xs text-ink-muted">{panel.doc ? `${panel.doc.title} ${panel.doc.version}` : "이 워크스페이스의 등록·폐기·복원·삭제 기록. 삭제된 문서의 기록도 남습니다."}</p>
              <ol className="max-h-[70vh] space-y-2 overflow-auto">
                {panel.items.map((e) => (
                  <li key={e.id} className="rounded-card border bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <Chip tone={actionTone[e.action]} className="h-5 text-[11px]">{actionLabel[e.action]}</Chip>
                      <span className="text-[11px] tabular-nums text-ink-muted">{fmt(e.at)}</span>
                    </div>
                    {!panel.doc && <div className="mt-1 font-medium text-ink">{e.document_label}</div>}
                    <div className="mt-1 text-xs text-ink-muted">{e.actor} · {e.source === "ui" ? "화면" : "스크립트"}{e.reason && ` · ${e.reason}`}</div>
                  </li>
                ))}
                {!panel.items.length && <li className="text-sm text-ink-muted">기록이 없습니다.</li>}
              </ol>
            </>
          )}
        </Card>
      </aside>
    </main>
  );
}

// tbody 안에서 fragment key 용
function RowGroup({ children }: { children: React.ReactNode }) { return <>{children}</>; }
