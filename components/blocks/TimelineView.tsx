"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Search, ChevronDown, CheckCircle2, Undo2, Plus, RefreshCw, Archive, RotateCcw, GitBranch, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Chip, TypeBadge, cn } from "@/components/ui";
import { ChainGraph } from "@/components/blocks/ChainGraph";
import { ResponsiveSheet, isNarrow } from "@/components/ui/ResponsiveSheet";
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

type Group = { root: LogNode; nodes: LogNode[]; dim: Set<number>; total: number; hasSuccess: boolean; last: string; resolved: boolean };

export function TimelineView({ wsId, logs: initialLogs, initialEntry, initialChain, initialShowResolved = false }: { wsId: number; logs: LogNode[]; initialEntry: number; initialChain: Chain | null; initialShowResolved?: boolean }) {
  const [logs, setLogs] = useState(initialLogs);
  const [type, setType] = useState<LogType | "all">("all");
  const [q, setQ] = useState("");
  const [showResolved, setShowResolved] = useState(initialShowResolved);
  const [hideDeprecated, setHideDeprecated] = useState(true); // 폐기 로그는 기본 숨김 (UX-003 C6)
  const [entryId, setEntryId] = useState(initialEntry);
  const [chain, setChain] = useState<Chain | null>(initialChain);
  // 펼친 장애 건. 처음 들어왔을 때 고른 건(defaultRoot)은 PC 에서만 펼쳐 보인다 — 폰은 모두 접힌 목록으로 시작(#113).
  // 서버 렌더와 같게 하려고 폭 판정 대신 CSS(max-lg:hidden)로 가른다
  const [open, setOpen] = useState<Set<number>>(() => new Set());
  const [defaultRoot, setDefaultRoot] = useState<number | null>(() => initialLogs.find((l) => l.id === initialEntry)?.root_id ?? null);
  const [limit, setLimit] = useState(PAGE);
  const [, startTransition] = useTransition();
  const cardRefs = useRef(new Map<number, HTMLLIElement>());
  // 폰·태블릿(~1023px): 목록만 두고, 해결 흐름·고른 기록 상세는 아래에서 올라오는 창으로(UX-005 §3-1, #112). PC 는 오른쪽 칸
  const [sheetOpen, setSheetOpen] = useState(false);
  const openFlow = () => { if (isNarrow()) setSheetOpen(true); };

  // 장애 건(루트) 단위 그룹 — 받은 전체 목록에서 계산 (페이지네이션되면 서버 집계로 이동)
  const { groups, hiddenResolved } = useMemo(() => {
    const byRoot = new Map<number, LogNode[]>();
    logs.forEach((l) => byRoot.set(l.root_id, [...(byRoot.get(l.root_id) ?? []), l]));
    const ql = q.trim().toLowerCase();
    const hit = (l: LogNode) => !ql || l.title.toLowerCase().includes(ql) || l.body.toLowerCase().includes(ql) || l.error_code?.toLowerCase().includes(ql) || l.keywords.some((k) => k.toLowerCase().includes(ql));
    const matched: Group[] = [...byRoot.entries()]
      .map(([rid, nodes]) => {
        const root = nodes.find((n) => n.id === rid) ?? nodes[0];
        const pool = nodes.filter((n) => !hideDeprecated || n.status === "active" || n.id === rid);
        const hits = pool.filter((n) => (type === "all" || n.type === type) && hit(n));
        // 필터·검색 중에는 맞은 로그의 상위(원인)도 흐리게 남겨 맥락을 유지한다 (UX-003 C7)
        const filtering = type !== "all" || !!ql;
        const keep = new Set(hits.map((n) => n.id));
        const dim = new Set<number>();
        if (filtering) hits.forEach((h) => pool.forEach((n) => { if (!keep.has(n.id) && n.id !== rid && h.path_label.startsWith(n.path_label + ".")) { keep.add(n.id); dim.add(n.id); } }));
        const visible = pool
          .filter((n) => keep.has(n.id))
          .sort((a, b) => a.path_label.localeCompare(b.path_label) || a.created_at.localeCompare(b.created_at)); // 트리 순서(원인 → 해결), 같은 깊이는 시간순
        return { root, nodes: visible, dim, total: nodes.filter((n) => n.status === "active").length, hasSuccess: nodes.some((n) => n.id !== root.id && n.type === "success" && n.status === "active"), last: nodes.reduce((m, n) => (n.created_at > m ? n.created_at : m), ""), resolved: !!root.resolved_at };
      })
      .filter((g) => g.nodes.length > 0);
    // 완료 숨김은 검색 뒤에 적용 — 검색·필터가 완료 건에만 맞으면 그 수를 따로 알려 준다(D-001)
    const entryRoot = logs.find((l) => l.id === entryId)?.root_id;
    const kept: Group[] = matched.filter((g) => showResolved || !g.resolved || g.root.root_id === entryRoot).sort((a, b) => b.last.localeCompare(a.last));
    return { groups: kept, hiddenResolved: type !== "all" || ql ? matched.length - kept.length : 0 };
  }, [logs, type, q, showResolved, hideDeprecated, entryId]);

  const counts = useMemo(
    () => { const live = logs.filter((l) => l.status === "active"); return { all: live.length, fail: live.filter((l) => l.type === "fail").length, success: live.filter((l) => l.type === "success").length, ref: live.filter((l) => l.type === "ref").length, deprecated: logs.length - live.length }; },
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
  const toggleGroup = (rid: number) => {
    if (rid === defaultRoot && !open.has(rid)) {
      // 처음 펼쳐 둔 건: PC 에선 펼쳐져 보이므로 접기, 폰에선 접혀 보이므로 펼치기
      setDefaultRoot(null);
      if (isNarrow()) setOpen((s) => new Set(s).add(rid));
      return;
    }
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(rid)) n.delete(rid);
      else n.add(rid);
      return n;
    });
  };
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
  const [ask, setAsk] = useState<{ id: number; orphaned: number[]; reason: string } | null>(null);
  const [note, setNote] = useState<{ id: number; text: string } | null>(null); // 성공 로그 없이 완료할 때 사유 입력
  const [flash, setFlash] = useState<string | null>(null);
  const applyStatus = async (id: number, status: "active" | "deprecated", cascade = false, reason?: string) => {
    setBusyId(id);
    setAsk(null);
    const r = await patchStatus(wsId, id, status, reason, cascade);
    if (r.ok) {
      patchInto(r.node);
      if (r.affected.length) {
        const fresh = await Promise.all(r.affected.map((a) => fetchLog(wsId, a)));
        fresh.forEach((f) => f && patchInto(f));
      }
      setFlash(status === "deprecated" ? `${1 + r.affected.length}건 폐기됨 — 검색에서 제외됩니다. 각 로그의 "복원"으로 되돌릴 수 있습니다` : `${1 + r.affected.length}건 복원됨`);
    } else {
      setFlash(r.message); // 서버가 거절한 이유를 그대로 보여준다
    }
    setBusyId(null);
  };
  // 폐기는 항상 사유를 받는다(UX-003 D3). 하위가 고아가 되면 범위도 함께 고른다
  const setStatus = async (id: number, status: "active" | "deprecated") => {
    if (status === "active") return applyStatus(id, "active");
    const orphaned = await fetchOrphaned(wsId, id);
    setAsk({ id, orphaned, reason: "" });
  };
  const titleOf = (id: number) => logs.find((l) => l.id === id)?.title ?? `#${id}`;
  // 렌더 함수로 부른다(<AskBox/> 로 쓰면 매 렌더 새 컴포넌트가 되어 입력 중 포커스를 잃는다)
  const AskBox = ({ id }: { id: number }) => {
    if (ask?.id !== id) return null;
    const ok = ask.reason.trim().length > 0;
    return (
      <div className="mt-1 flex flex-col gap-2 rounded-lg border border-warn-bg bg-warn-bg/50 px-3 py-2 text-xs text-ink">
        <label className="flex flex-wrap items-center gap-2">
          <span>폐기 사유</span>
          <input autoFocus value={ask.reason} onChange={(e) => setAsk({ ...ask, reason: e.target.value })} placeholder="예: 잘못 짚은 원인 / 중복 기록" className="h-7 min-w-56 flex-1 rounded-md border border-border bg-white px-2 text-xs" />
        </label>
        {ask.orphaned.length > 0 && (
          <div>
            <span>이어진 로그 <b>{ask.orphaned.length}건</b>이 앞 기록을 잃습니다: </span>
            <span className="text-ink-muted">{ask.orphaned.slice(0, 3).map(titleOf).join(" · ")}{ask.orphaned.length > 3 ? ` 외 ${ask.orphaned.length - 3}건` : ""}</span>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {ask.orphaned.length > 0 ? (
            <>
              <Button size="xs" variant="outline" disabled={!ok} onClick={() => applyStatus(id, "deprecated", true, ask.reason.trim())} className="text-warn hover:bg-warn-bg hover:text-warn">이어진 {ask.orphaned.length}건도 함께 폐기</Button>
              <Button size="xs" variant="outline" disabled={!ok} onClick={() => applyStatus(id, "deprecated", false, ask.reason.trim())}>이 로그만 폐기</Button>
            </>
          ) : (
            <Button size="xs" variant="outline" disabled={!ok} onClick={() => applyStatus(id, "deprecated", false, ask.reason.trim())} className="text-warn hover:bg-warn-bg hover:text-warn">폐기</Button>
          )}
          <Button size="xs" variant="ghost" onClick={() => setAsk(null)}>취소</Button>
        </div>
      </div>
    );
  };

  // 완료: 이어진 성공 로그가 있으면 바로, 없으면 사유를 받는다(UX-003 D1). 해제는 사유 없음
  const resolve = async (root: LogNode, value: boolean, text?: string) => {
    const r = await patchResolved(wsId, root.id, value, text);
    if (r.ok) {
      setNote(null);
      setLogs((ls) => ls.map((l) => (l.id === r.node.id ? { ...l, resolved_at: r.node.resolved_at, resolve_note: r.node.resolve_note } : l)));
    } else if (r.code === "NOTE_REQUIRED") {
      setNote({ id: root.id, text: "" });
    } else {
      setFlash(r.message);
    }
  };
  const NoteBox = ({ root }: { root: LogNode }) =>
    note?.id === root.id ? (
      <form className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-success-bg bg-success-bg/40 px-3 py-2 text-xs text-ink" onSubmit={(e) => { e.preventDefault(); if (note.text.trim()) resolve(root, true, note.text.trim()); }}>
        <span>이어진 해결(성공) 로그가 없습니다. 어떻게 마무리됐나요?</span>
        <input autoFocus value={note.text} onChange={(e) => setNote({ ...note, text: e.target.value })} placeholder="예: 재현 안 됨 / 외부 조치로 해소" className="h-7 min-w-56 flex-1 rounded-md border border-border bg-white px-2 text-xs" />
        <Button size="xs" type="submit" disabled={!note.text.trim()}>완료 처리</Button>
        <Button size="xs" type="button" variant="ghost" onClick={() => setNote(null)}>취소</Button>
      </form>
    ) : null;

  useEffect(() => {
    cardRefs.current.get(entryId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [entryId]);

  // 폐기·복원 안내는 6초 뒤 자동 닫힘
  useEffect(() => {
    if (!flash) return;
    const t = setTimeout(() => setFlash(null), 6000);
    return () => clearTimeout(t);
  }, [flash]);

  // AI 요약은 서버가 뒤에서 만든다(2~4초) — 만드는 중이면 5초 뒤 한 번만 다시 읽는다. 다시 읽어도 그대로면(AI 키 없음·자동 생성 끔) 더 부르지 않는다(백엔드 11/11 §2.3)
  const summaryStatus = chain?.summary_status;
  useEffect(() => {
    if (!entryId || (summaryStatus !== "none" && summaryStatus !== "stale" && summaryStatus !== "generating")) return;
    const t = setTimeout(() => fetchChain(wsId, entryId).then((c) => c && startTransition(() => setChain(c))), 5000);
    return () => clearTimeout(t);
  }, [summaryStatus, entryId, wsId]);

  useEffect(() => {
    if (!entryId) return; // 빈 워크스페이스: ?entry=0 을 URL에 남기지 않는다
    let alive = true;
    fetchChain(wsId, entryId).then((c) => alive && startTransition(() => setChain(c)));
    const url = new URL(window.location.href);
    url.searchParams.set("entry", String(entryId));
    window.history.replaceState(null, "", url);
    return () => {
      alive = false;
    };
  }, [wsId, entryId]);

  // 고른 기록 상세(정리 결과·칩·다시 정리·폐기·이 아래에 추가). PC 는 목록 안, 폰은 창 안 — 한 벌
  const detail = (l: LogNode) => (
<div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
                                  {l.resolution_summary && <p className="text-sm font-medium text-ink">{l.resolution_summary}</p>}
                                  <div className="flex flex-wrap gap-1.5">
                                    {l.error_code && <Chip tone="fail">{l.error_code}</Chip>}
                                    {l.keywords.map((k) => <Chip key={k}>#{k}</Chip>)}
                                    {l.refine_status === "done" ? <Chip tone="primary">검색 가능</Chip> : <Chip tone="warn">{l.refine_status === "failed" ? "정리 실패" : "정리 중"}</Chip>}
                                    {l.status === "deprecated" && <Chip tone="warn" title={l.deprecate_reason ? `사유: ${l.deprecate_reason}` : undefined}>폐기{l.deprecate_reason && ` · ${l.deprecate_reason}`}</Chip>}
                                  </div>
                                  <div className="flex items-center text-xs text-ink-muted">{l.author_name}
                                    <Link href={`/w/${wsId}/logs/new?parent=${l.id}`} className="ml-auto inline-flex items-center gap-1 font-medium text-primary-700 hover:underline pointer-coarse:min-h-11"><Plus className="size-3" /> 이 로그 아래에 추가</Link>
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
                                  {AskBox({ id: l.id })}
                                </div>
  );

  const entry = logs.find((l) => l.id === entryId);
  const entryRoot = entry ? logs.find((l) => l.id === entry.root_id) ?? entry : undefined;
  const flowBody = (
    chain ? (
      <>
        <ChainGraph chain={chain} selectedId={entryId} onSelect={select} />
        {/* FE-012 P1-7: 카드에 새로 붙는 표시의 뜻 */}
        <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
          <span><span className="rounded-full bg-fail px-1.5 text-white">원인</span> 장애 건의 원인으로 표시된 기록</span>
          <span><span className="rounded-full bg-success px-1.5 text-white">해결</span> 장애 건을 해결한 기록</span>
          <span><span className="rounded bg-primary-100 px-1 font-semibold text-primary-700">규정 따름</span>·<span className="rounded bg-warn-bg px-1 font-semibold text-warn">규정 예외</span>·<span className="rounded bg-ref-bg px-1 font-semibold">규정 없음</span> 이 조치가 사내 규정과 어떤 관계인지</span>
          <span>↳ 기울임 글씨 = 앞 기록에 이어 붙인 이유</span>
        </p>
        {chain.truncated && <p className="mt-2 text-xs text-warn">기록이 많아 {chain.nodes.length}건만 표시했습니다(전체 {chain.total}건). 목록에서 다른 기록을 눌러 그 주변을 볼 수 있습니다.</p>}
        {chain.summary && <SummaryBox chain={chain} />}
      </>
    ) : (
      <div className="py-16 text-center text-sm text-ink-muted">이 로그에 이어진 원인·해결이 아직 없습니다. &ldquo;로그 추가&rdquo;로 이어 주세요.</div>
    )
  );

  const shown = groups.slice(0, limit);

  return (
    <main className="grid items-start gap-4 p-3 sm:gap-6 md:p-6 lg:grid-cols-[minmax(20rem,25rem)_minmax(0,1fr)] xl:grid-cols-[28.75rem_minmax(0,1fr)] xl:p-8">
      {flash && (
        <div role="status" className="fixed inset-x-3 top-3 z-50 flex items-center gap-3 sm:inset-x-auto sm:right-6 sm:top-6 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-lg">
          <span className="text-ink">{flash}</span>
          <button type="button" onClick={() => setFlash(null)} className="rounded px-1 text-ink-muted hover:bg-primary-100" aria-label="닫기">×</button>
        </div>
      )}
      <section className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-ink">장애 건 타임라인</h2>
            <p className="mt-0.5 hidden text-xs text-ink-muted sm:block">장애 건 › 원인(실패) › 해결(성공)·참고 순으로 이어집니다</p>
          </div>
          <div className="relative w-full sm:w-60">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목 · 본문 · 오류 코드 · #키워드" className="h-9 w-full pl-9 pointer-coarse:h-11" />
          </div>
        </div>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {typeFilters.map((f) => (
            <button key={f.key} type="button" onClick={() => setType(f.key)} className={cn("flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors pointer-coarse:h-11 pointer-coarse:px-4", f.key === type ? "bg-primary-700 text-white" : f.cls)}>
              {f.label} {counts[f.key]}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-ink-muted pointer-coarse:min-h-11">
            <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} className="size-3.5 accent-[var(--color-primary-700)]" />
            완료 건 표시 ({resolvedCount})
          </label>
          {counts.deprecated > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-ink-muted pointer-coarse:min-h-11">
              <input type="checkbox" checked={!hideDeprecated} onChange={(e) => setHideDeprecated(!e.target.checked)} className="size-3.5 accent-[var(--color-primary-700)]" />
              폐기 표시 ({counts.deprecated})
            </label>
          )}
        </div>

        {hiddenResolved > 0 && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs text-ink">
            <span>완료된 장애 건에서도 <b>{hiddenResolved}건</b>이 맞습니다</span>
            <Button size="xs" variant="outline" onClick={() => setShowResolved(true)}>완료 건 표시</Button>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {shown.map((g) => {
            const userOpen = open.has(g.root.root_id);
            const isOpen = userOpen || g.root.root_id === defaultRoot;
            const pcOnly = !userOpen && isOpen; // 처음 펼쳐 둔 건 — 폰에서는 접힌 모습
            return (
              <Card key={g.root.root_id} className={cn("@container gap-0 overflow-visible p-0", g.resolved && "opacity-80")}>
                {/* 그룹 헤더 = 장애 건(메인 로그). 제목이 1행, 메타가 2행. 제목 클릭 = 루트 선택, 셰브론 = 펼침 */}
                <div className={cn("flex flex-wrap items-start gap-2 px-3 py-3 sm:gap-3 sm:px-4", g.root.id === entryId && "bg-primary-50")}>
                  <button type="button" onClick={() => toggleGroup(g.root.root_id)} className="mt-1 shrink-0 rounded p-0.5 text-ink-muted hover:bg-primary-100 pointer-coarse:-m-2.5 pointer-coarse:mt-[-6px] pointer-coarse:p-3" aria-expanded={isOpen} aria-label={isOpen ? "접기" : "펼치기"}>
                    <ChevronDown className={cn("size-4 transition-transform", !isOpen && "-rotate-90", pcOnly && "max-lg:-rotate-90")} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => { select(g.root.id); setOpen((o) => new Set(o).add(g.root.root_id)); openFlow(); }} className="block w-full text-left pointer-coarse:-my-2.5 pointer-coarse:py-2.5">
                      <div className={cn("text-[0.9375rem] font-bold leading-snug text-ink", g.resolved && "line-through opacity-70")}>{g.root.title}</div>
                    </button>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
                      <TypeBadge type={g.root.type} />
                      {g.root.error_code && <Chip tone="fail" className="h-5 text-xs">{g.root.error_code}</Chip>}
                      {g.root.type === "ref" ? <Chip tone="neutral" className="h-5 text-xs" title="절차·자료 기록. 완료 처리 대상이 아닙니다">자료</Chip> : g.resolved ? <Chip tone="primary" className="h-5 text-xs" title={g.root.resolve_note ? `완료 사유: ${g.root.resolve_note}` : "이어진 해결 로그로 완료"}>완료{g.root.resolve_note && " · 사유 있음"}</Chip> : <Chip tone="warn" className="h-5 text-xs">진행 중</Chip>}
                      <span>기록 {g.total}건</span>
                      <span>·</span>
                      <span>최근 {fmt(g.last)}</span>
                      <span>·</span>
                      <span>{g.root.author_name}</span>
                    </div>
                    {g.root.id === entryId && (
                      <div className="mt-2 border-t border-border pt-2 max-lg:hidden">
                        <p className="text-sm leading-relaxed text-ink-muted">{g.root.body}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">{g.root.keywords.map((k) => <Chip key={k}>#{k}</Chip>)}</div>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5 @max-md:w-full @max-md:flex-row @max-md:flex-wrap @max-md:items-center @max-md:justify-end">{/* 카드 폭 기준(좁은 왼쪽 칸·휴대폰): 동작 버튼을 제목 아래 한 줄로 */}
                    {g.root.type === "ref" ? null : g.resolved ? (
                      <Button variant="outline" size="xs" onClick={() => resolve(g.root, false)} title="완료 해제"><Undo2 className="size-3" /> 완료 해제</Button>
                    ) : (
                      <Button variant="outline" size="xs" onClick={() => resolve(g.root, true)} title={g.hasSuccess ? "이 장애 건을 완료 처리" : "해결 로그가 없어 완료 사유를 묻습니다"} className="text-success hover:bg-success-bg hover:text-success"><CheckCircle2 className="size-3" /> 완료 처리</Button>
                    )}
                    <Link href={`/w/${wsId}/logs/new?parent=${g.root.id}`} title="이 장애 건에 로그 추가" className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-ink hover:bg-primary-100 pointer-coarse:min-h-11"><Plus className="size-3" /> 로그 추가</Link>
                    {g.root.type !== "ref" && <Link href={`/w/${wsId}/reports/${g.root.id}`} title="이 장애 건의 보고서(템플릿 R1)" className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-ink hover:bg-primary-100 pointer-coarse:min-h-11"><FileText className="size-3" /> 보고서</Link>}
                    <Button size="xs" className="lg:hidden" onClick={() => { select(g.root.id); setSheetOpen(true); }}><GitBranch className="size-3" /> 해결 흐름 보기</Button>
                    {g.root.id === entryId && (
                      <div className="flex gap-1.5 max-lg:hidden">
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
                {note?.id === g.root.id && !sheetOpen && <div className="px-3 pb-3 sm:px-4">{NoteBox({ root: g.root })}</div>}
                {g.root.id === entryId && ask?.id === g.root.id && !sheetOpen && <div className="px-3 pb-3 sm:px-4 max-lg:hidden">{AskBox({ id: g.root.id })}</div>}
                {isOpen && (
                  <ol className={cn("relative mx-3 mb-3 ml-5 border-l border-border pl-4 sm:mx-4 sm:ml-7 sm:pl-5", pcOnly && "max-lg:hidden")}>
                    {g.nodes.filter((l) => l.id !== g.root.id).map((l) => {
                      const selected = l.id === entryId;
                      const depth = Math.max(0, l.path_label.split(".").length - g.root.path_label.split(".").length - 1);
                      return (
                        <li key={l.id} ref={(el) => { if (el) cardRefs.current.set(l.id, el); else cardRefs.current.delete(l.id); }} className="relative mb-2.5 last:mb-0" style={{ marginLeft: depth * 12 }}>
                          <span className={cn("absolute -left-[1.3125rem] top-4 size-2.5 rounded-full ring-4 ring-card sm:-left-[1.5625rem]", dotTone[l.type])} />
                          <div onClick={() => { select(l.id); openFlow(); }} className={cn("block w-full text-left", g.dim.has(l.id) && "opacity-50")}>
                            <div className={cn("rounded-lg border border-transparent px-2.5 py-2.5 transition-colors sm:px-3 hover:bg-primary-50", selected && "border-primary-400 bg-primary-50")}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex min-w-0 items-start gap-2">
                                  <TypeBadge type={l.type} />
                                  <button type="button" onClick={(e) => { e.stopPropagation(); select(l.id); openFlow(); }} className={cn("min-w-0 line-clamp-2 text-left text-sm font-semibold leading-snug text-ink", l.status === "deprecated" && "line-through opacity-60")}>{l.title}</button>
                                </div>
                                <span className="shrink-0 text-xs text-ink-muted">{fmt(l.created_at)}</span>
                              </div>
                              <p className={cn("mt-1 text-sm leading-relaxed text-ink-muted", !selected && "line-clamp-2")}>{l.body}</p>
                              {selected && <div className="max-lg:hidden">{detail(l)}</div>}
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
              <Link href={`/w/${wsId}/logs/new`} className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800"><Plus className="size-4" /> 첫 로그 등록</Link>
            </Card>
          ) : groups.length === 0 ? (
            <div className="py-10 text-center text-sm text-ink-muted">조건에 맞는 장애 건이 없습니다.</div>
          ) : null}
          {groups.length > limit && (
            <Button variant="outline" size="lg" onClick={() => setLimit((n) => n + PAGE)}>더 보기 ({groups.length - limit}건)</Button>
          )}
        </div>
      </section>

      {/* PC: 오른쪽 칸. 폰: 아래 창(같은 본문) */}
      <div className="hidden min-w-0 lg:sticky lg:top-24 lg:block">
      <Card className="min-w-0 p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2 sm:mb-5">
          <div className="min-w-0">
            <h2 className="font-bold text-ink">해결 흐름</h2>
            <p className="mt-0.5 text-sm text-ink-muted">장애 건 › 원인(실패) › 해결(성공)·참고 순서로 이어집니다. 로그를 누르면 관련된 흐름만 밝게 표시됩니다.</p>
          </div>
          <div className="flex gap-2">
            {(["fail", "success", "ref"] as LogType[]).map((t) => (
              <TypeBadge key={t} type={t} />
            ))}
          </div>
        </div>
        {flowBody}
      </Card>
      </div>

      <ResponsiveSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={entryRoot?.title ?? "해결 흐름"}
        description={entryRoot ? `${entryRoot.type === "ref" ? "자료" : entryRoot.resolved_at ? "완료" : "진행 중"} · 해결 흐름과 고른 기록` : undefined}>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {entry && entryRoot && (
            <section className="mb-4 rounded-xl border border-border p-3">
              <div className="mb-1 text-xs font-semibold text-ink-muted">고른 기록</div>
              <div className="flex items-start gap-2">
                <TypeBadge type={entry.type} />
                <div className={cn("min-w-0 text-sm font-semibold leading-snug text-ink", entry.status === "deprecated" && "line-through opacity-60")}>{entry.title}</div>
              </div>
              <p className="mt-1 text-xs text-ink-muted">{entry.author_name} · {fmt(entry.created_at)}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-muted">{entry.body}</p>
              {entry.id === entryRoot.id ? (
                <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
                  {entry.keywords.length > 0 && <div className="flex flex-wrap gap-1.5">{entry.keywords.map((k) => <Chip key={k}>#{k}</Chip>)}</div>}
                  <div className="flex flex-wrap gap-1.5">
                    {entry.type === "ref" ? null : entry.resolved_at ? (
                      <Button variant="outline" size="xs" onClick={() => resolve(entry, false)}><Undo2 className="size-3" /> 완료 해제</Button>
                    ) : (
                      <Button variant="outline" size="xs" onClick={() => resolve(entry, true)} className="text-success hover:bg-success-bg hover:text-success"><CheckCircle2 className="size-3" /> 완료 처리</Button>
                    )}
                    <Link href={`/w/${wsId}/logs/new?parent=${entry.id}`} className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-ink hover:bg-primary-100 pointer-coarse:min-h-11"><Plus className="size-3" /> 로그 추가</Link>
                    {entry.type !== "ref" && <Link href={`/w/${wsId}/reports/${entry.id}`} className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-ink hover:bg-primary-100 pointer-coarse:min-h-11"><FileText className="size-3" /> 보고서</Link>}
                    <Button variant="outline" size="xs" onClick={() => refine(entry.id)} disabled={busyId === entry.id}><RefreshCw className={cn("size-3", (entry.refine_status === "pending" || entry.refine_status === "processing") && "animate-spin")} /> 다시 정리</Button>
                    {entry.status === "deprecated" ? (
                      <Button variant="outline" size="xs" onClick={() => setStatus(entry.id, "active")} disabled={busyId === entry.id}><RotateCcw className="size-3" /> 복원</Button>
                    ) : (
                      <Button variant="outline" size="xs" onClick={() => setStatus(entry.id, "deprecated")} disabled={busyId === entry.id} className="text-warn hover:bg-warn-bg hover:text-warn"><Archive className="size-3" /> 폐기</Button>
                    )}
                  </div>
                  {note?.id === entry.id && NoteBox({ root: entry })}
                  {AskBox({ id: entry.id })}
                </div>
              ) : detail(entry)}
            </section>
          )}
          <h3 className="mb-2 text-sm font-semibold text-ink">해결 흐름 <span className="font-normal text-ink-muted">— 카드를 누르면 위 &ldquo;고른 기록&rdquo;이 바뀝니다</span></h3>
          {flowBody}
        </div>
      </ResponsiveSheet>
    </main>
  );
}

// 요약 칸: AI 가 쓴 글일 때만 "AI 요약". 틀 문장(none·AI 키 없음)은 "현황"으로 — 틀 문장에 AI 라벨을 붙이면 장애 건 요약으로 오해한다(#109)
function SummaryBox({ chain }: { chain: Chain }) {
  const st = chain.summary_status;
  const ai = st === "fresh" || st === "stale" || ((st === "generating" || st === "deprecated") && !!chain.summary_at);
  const at = chain.summary_at ? new Date(chain.summary_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : null;
  const note = st === "stale" ? "기록이 바뀌어 새 요약을 만드는 중입니다 — 이전 요약" : st === "none" || (st === "generating" && !ai) ? "AI 요약을 만드는 중이거나, 이 서버에서 AI 요약을 쓰지 않습니다" : null;
  return (
    <div className="mt-5 rounded-xl bg-primary-50 p-4 sm:mt-6 sm:p-5">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Chip tone={ai ? "dark" : "neutral"}>{ai ? (st === "stale" ? "이전 AI 요약" : "AI 요약") : "현황"}</Chip>
        <span className="text-xs text-ink-muted">{ai ? `이 장애 건 전체의 흐름을 한 단락으로${at ? ` · ${at}` : ""}` : "기록 수와 상태"}</span>
      </div>
      <p className="text-sm leading-relaxed text-ink">{chain.summary}</p>
      {note && <p className="mt-2 text-xs text-ink-muted">{note}</p>}
    </div>
  );
}
