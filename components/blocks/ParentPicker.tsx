"use client";
import { useMemo, useState } from "react";
import { Search, Link2, ChevronRight, Pencil, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Chip, TypeBadge, cn } from "@/components/ui";
import type { Chain, LogNode } from "@/lib/types/domain";

// 상위 로그 선택: 장애 건(메인 로그) 목록 → 하나 고르면 그 건의 트리에서 위치 선택.
// 자유 입력 없음(목록 선택만) → 고아 노드 불가. 검색은 목록 필터(자동완성 역할).
export const ROOT = "root";
const TREE_FULL_MAX = 15; // 이보다 크면 선택 노드 주변(조상 + 자식)만 보여준다

type Group = { root: LogNode; nodes: LogNode[]; last: string };

const depthOf = (n: LogNode, root: LogNode) => Math.max(0, n.path_label.split(".").length - root.path_label.split(".").length);
const parentLabel = (n: LogNode) => n.path_label.split(".").slice(0, -1).join(".");

export function ParentPicker({
  candidates,
  value,
  onChange,
  titleHint,
  chain,
}: {
  candidates: LogNode[];
  value: string; // ROOT | node id
  onChange: (v: string) => void;
  titleHint?: string; // 제목 입력값 — 에러 코드로 진행 중 장애 건 제안
  chain?: Chain | null; // 선택 부모의 체인(조상 포함) — 경로 표시용
}) {
  const parentNode = candidates.find((c) => String(c.id) === value) ?? null;
  const [locked, setLocked] = useState(!!parentNode); // ?parent= 진입: 요약만 보여주고 "변경"으로 연다
  const [q, setQ] = useState("");
  const [rootId, setRootId] = useState<number | null>(parentNode?.root_id ?? null);

  const groups = useMemo<Group[]>(() => {
    const by = new Map<number, LogNode[]>();
    candidates.forEach((c) => by.set(c.root_id, [...(by.get(c.root_id) ?? []), c]));
    return [...by.entries()]
      .map(([rid, nodes]) => ({ root: nodes.find((n) => n.id === rid) ?? nodes[0], nodes, last: nodes.reduce((m, n) => (n.created_at > m ? n.created_at : m), "") }))
      .sort((a, b) => Number(!!a.root.resolved_at) - Number(!!b.root.resolved_at) || b.last.localeCompare(a.last));
  }, [candidates]);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return groups;
    return groups.filter((g) => g.nodes.some((n) => n.title.toLowerCase().includes(ql) || n.error_code?.toLowerCase().includes(ql) || n.keywords.some((k) => k.toLowerCase().includes(ql))));
  }, [groups, q]);

  const suggestion = useMemo(() => {
    const code = /([A-Z]{1,4}-?\d{3,4}|HTTP\s?\d{3})/i.exec(titleHint ?? "")?.[0]?.toUpperCase();
    if (!code) return null;
    return groups.find((g) => !g.root.resolved_at && g.nodes.some((n) => n.error_code?.toUpperCase() === code)) ?? null;
  }, [groups, titleHint]);

  const group = groups.find((g) => g.root.root_id === rootId) ?? null;

  // 트리: 작은 건은 전체, 큰 건은 선택 노드의 조상 + 선택 노드 + 직접 자식만
  const tree = useMemo(() => {
    if (!group) return [];
    const sorted = [...group.nodes].sort((a, b) => a.path_label.localeCompare(b.path_label) || a.created_at.localeCompare(b.created_at));
    if (sorted.length <= TREE_FULL_MAX || !parentNode) return sorted;
    const keep = new Set<string>();
    const segs = parentNode.path_label.split(".");
    for (let i = 1; i <= segs.length; i++) keep.add(segs.slice(0, i).join("."));
    return sorted.filter((n) => keep.has(n.path_label) || parentLabel(n) === parentNode.path_label);
  }, [group, parentNode]);

  const pickRoot = (g: Group) => {
    setRootId(g.root.root_id);
    onChange(String(g.root.id));
  };

  // 경로(루트 → … → 부모): 체인의 조상(depth<0)이 있으면 그걸 쓰고, 없으면 path_label로 복원
  const crumbs = useMemo<LogNode[]>(() => {
    if (!parentNode) return [];
    if (chain) {
      const anc = chain.nodes.filter((n) => n.depth < 0).sort((a, b) => a.depth - b.depth);
      const ids = [...anc.map((n) => n.id), parentNode.id];
      return ids.map((id) => candidates.find((c) => c.id === id)).filter((x): x is LogNode => !!x);
    }
    const segs = parentNode.path_label.split(".");
    const out: LogNode[] = [];
    for (let i = 1; i < segs.length; i++) {
      const n = candidates.find((c) => c.root_id === parentNode.root_id && c.path_label === segs.slice(0, i).join("."));
      if (n) out.push(n);
    }
    return [...out, parentNode];
  }, [parentNode, chain, candidates]);

  if (locked && parentNode) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5">
          <Link2 className="size-4 shrink-0 text-primary-700" />
          <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
            {crumbs.map((c, i) => (
              <li key={c.id} className="flex min-w-0 items-center gap-1">
                {i > 0 && <ChevronRight className="size-3.5 shrink-0 text-ink-muted" />}
                <span className={cn("truncate", i === crumbs.length - 1 ? "font-semibold text-ink" : "text-ink-muted")}>{c.title}</span>
              </li>
            ))}
          </ol>
          <button type="button" onClick={() => setLocked(false)} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border bg-card px-2 text-xs font-medium text-ink hover:bg-primary-100">
            <Pencil className="size-3" /> 변경
          </button>
        </div>
        <p className="px-1 text-xs text-ink-muted">새 로그는 <b className="text-ink">{parentNode.title}</b> 다음에 이어집니다.</p>
        <input type="hidden" name="parent_id" value={value} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {suggestion && suggestion.root.root_id !== rootId && (
        <button type="button" onClick={() => pickRoot(suggestion)} className="flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2 text-left text-sm hover:bg-primary-100">
          <Sparkles className="size-4 shrink-0 text-primary-700" />
          <span className="min-w-0 truncate"><span className="text-ink-muted">같은 에러 코드의 진행 중 장애 건: </span><span className="font-semibold text-ink">{suggestion.root.title}</span></span>
          <span className="ml-auto shrink-0 text-xs font-semibold text-primary-700">연결</span>
        </button>
      )}

      {/* ① 새 장애 건 — 독립 카드 */}
      <button
        type="button"
        onClick={() => { setRootId(null); onChange(ROOT); }}
        aria-pressed={value === ROOT}
        className={cn(
          "flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors",
          value === ROOT ? "border-primary-700 bg-primary-700 text-white" : "border-dashed border-primary-200 bg-card text-ink hover:bg-primary-50",
        )}
      >
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-base font-bold", value === ROOT ? "bg-white/20" : "bg-primary-100 text-primary-700")}>+</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold">새 장애 건 시작</span>
          <span className={cn("block text-xs", value === ROOT ? "text-white/80" : "text-ink-muted")}>처음 겪는 문제일 때 — 이 로그가 장애 건의 첫 기록이 됩니다</span>
        </span>
      </button>

      {/* ② 등록된 메인 로그 — 선택하면 아래에 하위 로그 트리 */}
      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between border-b border-border bg-primary-50 px-3 py-2">
          <span className="text-xs font-semibold text-ink">이미 등록된 장애 건 {groups.length}건</span>
          <span className="text-[11px] text-ink-muted">진행 중 먼저 · 최근 활동순</span>
        </div>
        <div className="relative border-b border-border">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="제목 · 에러 코드 · #키워드로 찾기" className="h-10 rounded-none border-0 pl-9 shadow-none focus-visible:ring-0" />
        </div>
        <ul className="max-h-48 overflow-y-auto">
          {filtered.slice(0, 20).map((g) => {
            const on = g.root.root_id === rootId;
            return (
              <li key={g.root.root_id}>
                <button type="button" onClick={() => pickRoot(g)} className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-primary-50", on && "bg-primary-100")}>
                  <TypeBadge type={g.root.type} />
                  <span className={cn("min-w-0 flex-1 truncate", g.root.resolved_at ? "text-ink-muted line-through" : "text-ink")}>{g.root.title}</span>
                  {g.root.error_code && <Chip tone="fail" className="h-5 shrink-0 text-[11px]">{g.root.error_code}</Chip>}
                  <span className="shrink-0 text-xs text-ink-muted">{g.nodes.length}건{g.root.resolved_at ? " · 완료" : ""}</span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 && <li className="px-3 py-4 text-center text-xs text-ink-muted">{q ? "검색 결과가 없습니다" : "아직 등록된 장애 건이 없습니다 — 위의 \u201c새 장애 건 시작\u201d으로 적으세요"}</li>}
          {filtered.length > 20 && <li className="px-3 py-2 text-center text-xs text-ink-muted">상위 20건만 표시 — 검색어로 좁혀 주세요</li>}
        </ul>
      </div>

      {/* 선택한 건의 트리에서 위치 선택 */}
      {group && (
        <div className="rounded-lg border border-border bg-primary-50/60 p-2">
          <div className="mb-1.5 flex items-center justify-between px-1 text-xs">
            <span className="font-semibold text-ink">어느 로그에 이어서 적나요? <span className="font-normal text-ink-muted">(기본: 장애 건 첫 기록)</span></span>
            {group.nodes.length > TREE_FULL_MAX && <span>로그가 많아 선택한 위치 주변만 표시</span>}
          </div>
          <ul className="flex flex-col gap-0.5">
            {tree.map((n) => {
              const on = String(n.id) === value;
              const dead = n.status === "deprecated";
              return (
                <li key={n.id} style={{ paddingLeft: depthOf(n, group.root) * 16 }}>
                  <button type="button" disabled={dead} onClick={() => onChange(String(n.id))} className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm", on ? "bg-primary-700 text-white" : "hover:bg-primary-100", dead && "opacity-40 line-through")}>
                    <span className={cn("size-1.5 rounded-full", n.type === "fail" ? "bg-fail" : n.type === "success" ? "bg-success" : "bg-ref", on && "bg-white")} />
                    <span className="truncate">{n.title}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <input type="hidden" name="parent_id" value={value} />
    </div>
  );
}
