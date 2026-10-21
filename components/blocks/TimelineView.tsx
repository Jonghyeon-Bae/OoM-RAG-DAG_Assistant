"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, ChevronDown, CheckCircle2, Undo2, Plus, RefreshCw, Archive, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip, TypeBadge, cn } from "@/components/ui";
import { ChainGraph } from "@/components/blocks/ChainGraph";
import { fetchChain, fetchLog, fetchOrphaned, patchResolved, patchStatus, postRefine } from "@/lib/api/client";
import type { Chain, LogNode, LogType } from "@/lib/types/domain";

const typeFilters: { key: LogType | "all"; label: string; cls: string }[] = [
  { key: "all", label: "전체", cls: "bg-ref-bg text-ref" },
  { key: "fail", label: "실패", cls: "bg-fail-bg text-fail" },
  { key: "success", label: "성공", cls: "bg-success-bg text-success" },
  { key: "ref", label: "참고", cls: "bg-ref-bg text-ref" },
];
const dotTone: Record<LogType, string> = { fail: "bg-fail", success: "bg-success", ref: "bg-ref" };
const PAGE = 8;

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Group = { root: LogNode; nodes: LogNode[]; last: string; resolved: boolean };

export function TimelineView({ wsId, logs: initialLogs, initialEntry, initialChain }: { wsId: number; logs: LogNode[]; initialEntry: number; initialChain: Chain | null }) {
  const [logs, setLogs] = useState(initialLogs);
  const [type, setType] = useState<LogType | "all">("all");
  const [q, setQ] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [entryId, setEntryId] = useState(initialEntry);
  const [chain, setChain] = useState<Chain | null>(initialChain);
  const [open, setOpen] = useState<Set<number>>(() => new Set([initialLogs.find((l) => l.id === initialEntry)?.root_id ?? 0]));
  const [limit, setLimit] = useState(PAGE);
  const [, startTransition] = useTransition();
  const cardRefs = useRef(new Map<number, HTMLLIElement>());

  // 장애 건(루트) 단위 그룹 — 받은 전체 목록에서 계산 (페이지네이션되면 서버 집계로 이동)
  const groups = useMemo<Group[]>(() => {
    const byRoot = new Map<number, LogNode[]>();
    logs.forEach((l) => byRoot.set(l.root_id, [...(byRoot.get(l.root_id) ?? []), l]));
    const ql = q.trim().toLowerCase();
    const hit = (l: LogNode) => !ql || l.title.toLowerCase().includes(ql) || l.body.toLowerCase().includes(ql) || l.error_code?.toLowerCase().includes(ql) || l.keywords.some((k) => k.toLowerCase().includes(ql));
    return [...byRoot.entries()]
      .map(([rid, nodes]) => {
        const root = nodes.find((n) => n.id === rid) ?? nodes[0];
        const visible = nodes
          .filter((n) => (type === "all" || n.type === type) && hit(n))
          .sort((a, b) => a.path_label.localeCompare(b.path_label) || a.created_at.localeCompare(b.created_at)); // 트리 순서(원인 → 해결), 같은 깊이는 시간순
        return { root, nodes: visible, last: nodes.reduce((m, n) => (n.created_at > m ? n.created_at : m), ""), resolved: !!root.resolved_at };
      })
      .filter((g) => g.nodes.length > 0 && (showResolved || !g.resolved || g.root.root_id === logs.find((l) => l.id === entryId)?.root_id))
      .sort((a, b) => b.last.localeCompare(a.last));
  }, [logs, type, q, showResolved, entryId]);

  const counts = useMemo(
    () => ({ all: logs.length, fail: logs.filter((l) => l.type === "fail").length, success: logs.filter((l) => l.type === "success").length, ref: logs.filter((l) => l.type === "ref").length }),
    [logs],
  );
  const resolvedCount = useMemo(() => logs.filter((l) => l.id === l.root_id && l.resolved_at).length, [logs]);

  const select = (id: number) => {
    const node = logs.find((l) => l.id === id);
    if (!node) return;
    if (type !== "all" && node.type !== type) setType("all");
    setOpen((s) => new Set(s).add(node.root_id));
    setEntryId(id);
  };
  const toggleGroup = (rid: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(rid)) n.delete(rid);
      else n.add(rid);
      return n;
    });
  // 노드 단위 액션: 재정제(정제 컬럼만 재생성, 간선·하위 무관) / 폐기 / 복원. 결과를 목록에 반영하고 정제 중이면 완료까지 폴링.
  const [busyId, setBusyId] = useState<number | null>(null);
  const patchInto = (n: LogNode) => setLogs((ls) => ls.map((l) => (l.id === n.id ? { ...l, ...n } : l)));
  const pollUntilDone = (id: number) => {
    const tick = async () => {
      const n = await fetchLog(wsId, id);
      if (!n) return;
      patchInto(n);
      if (n.refine_status === "pending" || n.refine_status === "processing") setTimeout(tick, 1000);
    };
    setTimeout(tick, 800);
  };
  const refine = async (id: number) => {
    setBusyId(id);
    const n = await postRefine(wsId, id);
    if (n) { patchInto(n); pollUntilDone(id); }
    setBusyId(null);
  };
  // 폐기: 하위가 고아가 되는 노드면 인라인으로 범위를 묻는다 (이 노드만 / 하위 N건 포함). 복원은 함께 폐기됐던 하위도 되살린다.
  const [ask, setAsk] = useState<{ id: number; orphaned: number[] } | null>(null);
  const applyStatus = async (id: number, status: "active" | "deprecated", cascade = false) => {
    setBusyId(id);
    setAsk(null);
    const r = await patchStatus(wsId, id, status, status === "deprecated" ? "사용자 폐기" : undefined, cascade);
    if (r) {
      const { affected, ...n } = r;
      patchInto(n);
      if (affected.length) {
        const fresh = await Promise.all(affected.map((a) => fetchLog(wsId, a)));
        fresh.forEach((f) => f && patchInto(f));
      }
    }
    setBusyId(null);
  };
  const setStatus = async (id: number, status: "active" | "deprecated") => {
    if (status === "active") return applyStatus(id, "active");
    const orphaned = await fetchOrphaned(wsId, id);
    if (orphaned.length === 0) return applyStatus(id, "deprecated");
    setAsk({ id, orphaned });
  };
  const AskBox = ({ id }: { id: number }) =>
    ask?.id === id ? (
      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-warn-bg bg-warn-bg/50 px-3 py-2 text-xs text-ink">
        <span>이 로그를 폐기하면 여기에 이어진 로그 <b>{ask.orphaned.length}건</b>이 앞 기록을 잃습니다.</span>
        <Button size="xs" variant="outline" onClick={() => applyStatus(id, "deprecated", true)} className="text-warn hover:bg-warn-bg hover:text-warn">이어진 {ask.orphaned.length}건도 함께 폐기</Button>
        <Button size="xs" variant="outline" onClick={() => applyStatus(id, "deprecated", false)}>이 로그만 폐기</Button>
        <Button size="xs" variant="ghost" onClick={() => setAsk(null)}>취소</Button>
      </div>
    ) : null;

  const resolve = async (root: LogNode, value: boolean) => {
    const n = await patchResolved(wsId, root.id, value);
    if (n) setLogs((ls) => ls.map((l) => (l.id === n.id ? { ...l, resolved_at: n.resolved_at } : l)));
  };

  useEffect(() => {
    cardRefs.current.get(entryId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [entryId]);

  useEffect(() => {
    let alive = true;
    fetchChain(wsId, entryId).then((c) => alive && startTransition(() => setChain(c)));
    const url = new URL(window.location.href);
    url.searchParams.set("entry", String(entryId));
    window.history.replaceState(null, "", url);
    return () => {
      alive = false;
    };
  }, [wsId, entryId]);

  const shown = groups.slice(0, limit);

  return (
    <main className="grid grid-cols-[460px_1fr] items-start gap-6 p-8">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-ink">장애 건 타임라인</h2>
            <p className="mt-0.5 text-xs text-ink-muted">장애 건 › 원인(실패) › 해결(성공)·참고 순으로 이어집니다</p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목 · 본문 · 오류 코드 · #키워드" className="h-9 w-60 pl-9" />
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {typeFilters.map((f) => (
            <button key={f.key} type="button" onClick={() => setType(f.key)} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors", f.key === type ? "bg-primary-700 text-white" : f.cls)}>
              {f.label} {counts[f.key]}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-muted">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="size-3.5 accent-[var(--color-primary-700)]" />
            완료 건 표시 ({resolvedCount})
          </label>
        </div>

        <div className="flex flex-col gap-3">
          {shown.map((g) => {
            const isOpen = open.has(g.root.root_id);
            return (
              <Card key={g.root.root_id} className={cn("gap-0 overflow-visible p-0", g.resolved && "opacity-80")}>
                {/* 그룹 헤더 = 장애 건(메인 로그). 제목이 1행, 메타가 2행. 제목 클릭 = 루트 선택, 셰브론 = 펼침 */}
                <div className={cn("flex items-start gap-3 px-4 py-3", g.root.id === entryId && "bg-primary-50")}>
                  <button type="button" onClick={() => toggleGroup(g.root.root_id)} className="mt-1 shrink-0 rounded p-0.5 text-ink-muted hover:bg-primary-100" aria-expanded={isOpen} aria-label={isOpen ? "접기" : "펼치기"}>
                    <ChevronDown className={cn("size-4 transition-transform", !isOpen && "-rotate-90")} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => { select(g.root.id); setOpen((o) => new Set(o).add(g.root.root_id)); }} className="block w-full text-left">
                      <div className={cn("text-[15px] font-bold leading-snug text-ink", g.resolved && "line-through opacity-70")}>{g.root.title}</div>
                    </button>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                      <TypeBadge type={g.root.type} />
                      {g.root.error_code && <Chip tone="fail" className="h-5 text-[11px]">{g.root.error_code}</Chip>}
                      {g.resolved ? <Chip tone="primary" className="h-5 text-[11px]">완료</Chip> : <Chip tone="warn" className="h-5 text-[11px]">진행 중</Chip>}
                      <span>기록 {g.nodes.length + 1}건</span>
                      <span>·</span>
                      <span>최근 {fmt(g.last)}</span>
                      <span>·</span>
                      <span>{g.root.author_name}</span>
                    </div>
                    {g.root.id === entryId && (
                      <div className="mt-2 border-t border-border pt-2">
                        <p className="text-sm leading-relaxed text-ink-muted">{g.root.body}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">{g.root.keywords.map((k) => <Chip key={k}>#{k}</Chip>)}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {g.resolved ? (
                      <Button variant="outline" size="xs" onClick={() => resolve(g.root, false)} title="완료 해제"><Undo2 className="size-3" /> 완료 해제</Button>
                    ) : (
                      <Button variant="outline" size="xs" onClick={() => resolve(g.root, true)} title="이 장애 건을 완료 처리" className="text-success hover:bg-success-bg hover:text-success"><CheckCircle2 className="size-3" /> 완료 처리</Button>
                    )}
                    <Link href={`/w/${wsId}/logs/new?parent=${g.root.id}`} title="이 장애 건에 로그 추가" className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-ink hover:bg-primary-100"><Plus className="size-3" /> 로그 추가</Link>
                    {g.root.id === entryId && (
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="xs" onClick={() => refine(g.root.id)} disabled={busyId === g.root.id} title="이 기록의 AI 정리만 다시 합니다. 관련 로그 무관"><RefreshCw className={cn("size-3", (g.root.refine_status === "pending" || g.root.refine_status === "processing") && "animate-spin")} /> 다시 정리</Button>
                        {g.root.status === "deprecated" ? (
                          <Button variant="outline" size="xs" onClick={() => setStatus(g.root.id, "active")} disabled={busyId === g.root.id}><RotateCcw className="size-3" /> 복원</Button>
                        ) : (
                          <Button variant="outline" size="xs" onClick={() => setStatus(g.root.id, "deprecated")} disabled={busyId === g.root.id} title="검색에서 뺍니다. 범위(이 로그만 / 이어진 로그 포함)는 다음에 고릅니다" className="text-warn hover:bg-warn-bg hover:text-warn"><Archive className="size-3" /> 폐기</Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {g.root.id === entryId && ask?.id === g.root.id && <div className="px-4 pb-3"><AskBox id={g.root.id} /></div>}
                {isOpen && (
                  <ol className="relative mx-4 mb-3 ml-7 border-l border-border pl-5">
                    {g.nodes.filter((l) => l.id !== g.root.id).map((l) => {
                      const selected = l.id === entryId;
                      const depth = Math.max(0, l.path_label.split(".").length - g.root.path_label.split(".").length - 1);
                      return (
                        <li key={l.id} ref={(el) => { if (el) cardRefs.current.set(l.id, el); else cardRefs.current.delete(l.id); }} className="relative mb-2.5 last:mb-0" style={{ marginLeft: depth * 18 }}>
                          <span className={cn("absolute -left-[25px] top-4 size-2.5 rounded-full ring-4 ring-card", dotTone[l.type])} />
                          <div role="button" tabIndex={0} onClick={() => select(l.id)} onKeyDown={(e) => e.key === "Enter" && select(l.id)} className="block w-full text-left">
                            <div className={cn("rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:bg-primary-50", selected && "border-primary-400 bg-primary-50")}>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 items-center gap-2">
                                  <TypeBadge type={l.type} />
                                  <span className={cn("truncate text-sm font-semibold text-ink", l.status === "deprecated" && "line-through opacity-60")}>{l.title}</span>
                                </div>
                                <span className="shrink-0 text-xs text-ink-muted">{fmt(l.created_at)}</span>
                              </div>
                              <p className={cn("mt-1 text-sm leading-relaxed text-ink-muted", !selected && "line-clamp-2")}>{l.body}</p>
                              {selected && (
                                <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
                                  {l.resolution_summary && <p className="text-sm font-medium text-ink">{l.resolution_summary}</p>}
                                  <div className="flex flex-wrap gap-1.5">
                                    {l.error_code && <Chip tone="fail">{l.error_code}</Chip>}
                                    {l.keywords.map((k) => <Chip key={k}>#{k}</Chip>)}
                                    {l.refine_status === "done" ? <Chip tone="primary">검색 가능</Chip> : <Chip tone="warn">{l.refine_status === "failed" ? "정리 실패" : "정리 중"}</Chip>}
                                    {l.status === "deprecated" && <Chip tone="warn">폐기</Chip>}
                                  </div>
                                  <div className="flex items-center text-xs text-ink-muted">{l.author_name}
                                    <Link href={`/w/${wsId}/logs/new?parent=${l.id}`} className="ml-auto inline-flex items-center gap-1 font-medium text-primary-700 hover:underline"><Plus className="size-3" /> 이 로그 아래에 추가</Link>
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 pt-1" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="outline" size="xs" onClick={() => refine(l.id)} disabled={busyId === l.id || l.refine_status === "processing"} title="적은 내용은 그대로 두고 AI 정리만 다시 합니다. 앞뒤 연결에는 영향 없음">
                                      <RefreshCw className={cn("size-3", (l.refine_status === "pending" || l.refine_status === "processing") && "animate-spin")} /> 다시 정리
                                    </Button>
                                    {l.status === "deprecated" ? (
                                      <Button variant="outline" size="xs" onClick={() => setStatus(l.id, "active")} disabled={busyId === l.id} title="검색에 다시 포함"><RotateCcw className="size-3" /> 복원</Button>
                                    ) : (
                                      <Button variant="outline" size="xs" onClick={() => setStatus(l.id, "deprecated")} disabled={busyId === l.id} title="검색에서 뺍니다. 내용과 연결은 남고 되돌릴 수 있습니다" className="text-warn hover:bg-warn-bg hover:text-warn"><Archive className="size-3" /> 폐기</Button>
                                    )}
                                  </div>
                                  <AskBox id={l.id} />
                                </div>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                    {g.nodes.filter((l) => l.id !== g.root.id).length === 0 && <li className="py-2 text-xs text-ink-muted">아직 이어진 로그가 없습니다. &ldquo;로그 추가&rdquo;로 원인·해결을 이어 주세요.</li>}
                  </ol>
                )}
              </Card>
            );
          })}
          {logs.length === 0 ? (
            <Card className="items-center gap-3 p-8 text-center">
              <p className="font-semibold text-ink">아직 등록된 장애 건이 없습니다</p>
              <p className="text-sm text-ink-muted">겪은 문제를 짧게 적어 두면, 다음 사람이 같은 문제를 만났을 때 여기서 해결 흐름을 봅니다.</p>
              <Link href={`/w/${wsId}/logs/new`} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-[#27507a]"><Plus className="size-4" /> 첫 로그 등록</Link>
            </Card>
          ) : groups.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-muted">조건에 맞는 장애 건이 없습니다.</div>
          ) : null}
          {groups.length > limit && (
            <Button variant="outline" size="lg" onClick={() => setLimit((n) => n + PAGE)}>더 보기 ({groups.length - limit}건)</Button>
          )}
        </div>
      </section>

      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-ink">해결 흐름</h2>
            <p className="mt-0.5 text-sm text-ink-muted">장애 건 › 원인(실패) › 해결(성공)·참고 순서로 이어집니다. 로그를 누르면 관련된 흐름만 밝게 표시됩니다.</p>
          </div>
          <div className="flex gap-2">
            {(["fail", "success", "ref"] as LogType[]).map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
        {chain ? (
          <>
            <ChainGraph chain={chain} selectedId={entryId} onSelect={select} />
            <div className="mt-6 rounded-xl bg-primary-50 p-5">
              <div className="mb-2 flex items-center gap-3">
                <Chip tone="dark">AI 요약</Chip>
                <span className="text-xs text-ink-muted">이 장애 건의 흐름을 한 단락으로</span>
              </div>
              <p className="text-sm leading-relaxed text-ink">{chain.summary}</p>
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-sm text-ink-muted">이 로그에 이어진 원인·해결이 아직 없습니다. &ldquo;로그 추가&rdquo;로 이어 주세요.</div>
        )}
      </Card>
    </main>
  );
}
