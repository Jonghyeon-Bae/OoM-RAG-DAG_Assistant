"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Search, ChevronDown, CheckCircle2, Undo2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip, TypeBadge, cn } from "@/components/ui";
import { ChainGraph } from "@/components/blocks/ChainGraph";
import { fetchChain, patchResolved } from "@/lib/api/client";
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
        const visible = nodes.filter((n) => (type === "all" || n.type === type) && hit(n)).sort((a, b) => b.created_at.localeCompare(a.created_at));
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
          <h2 className="font-bold text-ink">장애 건 타임라인</h2>
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
                {/* 그룹 헤더 = 장애 건 */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <button type="button" onClick={() => toggleGroup(g.root.root_id)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen}>
                    <ChevronDown className={cn("size-4 shrink-0 text-ink-muted transition-transform", !isOpen && "-rotate-90")} />
                    <TypeBadge type={g.root.type} />
                    <span className={cn("truncate font-semibold text-ink", g.resolved && "line-through")}>{g.root.title}</span>
                    {g.root.error_code && <Chip tone="fail" className="shrink-0">{g.root.error_code}</Chip>}
                  </button>
                  <span className="shrink-0 text-xs text-ink-muted">{g.nodes.length}건 · {fmt(g.last)}</span>
                  {g.resolved ? (
                    <Button variant="outline" size="xs" onClick={() => resolve(g.root, false)} title="완료 해제"><Undo2 className="size-3" /> 완료됨</Button>
                  ) : (
                    <Button variant="outline" size="xs" onClick={() => resolve(g.root, true)} title="이 장애 건을 완료 처리" className="text-success hover:bg-success-bg hover:text-success"><CheckCircle2 className="size-3" /> 완료 처리</Button>
                  )}
                </div>

                {isOpen && (
                  <ol className="relative mx-4 mb-3 ml-7 border-l border-border pl-5">
                    {g.nodes.map((l) => {
                      const selected = l.id === entryId;
                      return (
                        <li key={l.id} ref={(el) => { if (el) cardRefs.current.set(l.id, el); else cardRefs.current.delete(l.id); }} className="relative mb-2.5 last:mb-0">
                          <span className={cn("absolute -left-[25px] top-4 size-2.5 rounded-full ring-4 ring-card", dotTone[l.type])} />
                          <button type="button" onClick={() => select(l.id)} className="block w-full text-left">
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
                                    {l.refine_status !== "done" && <Chip tone="warn">{l.refine_status === "failed" ? "정제 실패" : "정제 전"}</Chip>}
                                    {l.status === "deprecated" && <Chip tone="warn">폐기</Chip>}
                                  </div>
                                  <div className="text-xs text-ink-muted">{l.author_name} · {l.path_label}</div>
                                </div>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </Card>
            );
          })}
          {groups.length === 0 && <div className="py-10 text-center text-sm text-ink-muted">조건에 맞는 장애 건이 없습니다.</div>}
          {groups.length > limit && (
            <Button variant="outline" size="lg" onClick={() => setLimit((n) => n + PAGE)}>더 보기 ({groups.length - limit}건)</Button>
          )}
        </div>
      </section>

      <Card className="p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-ink">계층형 트러블슈팅 DAG</h2>
            <p className="mt-0.5 text-sm text-ink-muted">간선 테이블 + 재귀 CTE 기반 부모(원인) → 자식(해결) 탐색</p>
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
                <Chip tone="dark">AI 체인 요약</Chip>
                <span className="text-xs text-ink-muted">프롬프트에 부모-자식 3단계 체인을 함께 주입</span>
              </div>
              <p className="text-sm leading-relaxed text-ink">{chain.summary}</p>
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-sm text-ink-muted">선택한 로그에 연결된 체인이 없습니다. 상위 로그를 연결하면 여기에 표시됩니다.</div>
        )}
      </Card>
    </main>
  );
}
