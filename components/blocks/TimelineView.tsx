"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Chip, TypeBadge, cn } from "@/components/ui";
import { ChainGraph } from "@/components/blocks/ChainGraph";
import { fetchChain } from "@/lib/api/client";
import type { Chain, LogNode, LogType } from "@/lib/types/domain";

const filters: { key: LogType | "all"; label: string; cls: string }[] = [
  { key: "all", label: "전체", cls: "bg-ref-bg text-ref" },
  { key: "fail", label: "실패", cls: "bg-fail-bg text-fail" },
  { key: "success", label: "성공", cls: "bg-success-bg text-success" },
  { key: "ref", label: "참고", cls: "bg-ref-bg text-ref" },
];
const dotTone: Record<LogType, string> = { fail: "bg-fail", success: "bg-success", ref: "bg-ref" };

function fmt(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function TimelineView({
  wsId,
  logs,
  initialEntry,
  initialChain,
}: {
  wsId: number;
  logs: LogNode[];
  initialEntry: number;
  initialChain: Chain | null;
}) {
  const [type, setType] = useState<LogType | "all">("all");
  const [q, setQ] = useState("");
  const [entryId, setEntryId] = useState(initialEntry);
  const [chain, setChain] = useState<Chain | null>(initialChain);
  const [, startTransition] = useTransition();
  const cardRefs = useRef(new Map<number, HTMLLIElement>());

  // 받은 목록 기준 파생값 (연산 배치 규칙: 전체 집합이 손에 있을 때만 프론트 계산)
  const counts = useMemo(
    () => ({
      all: logs.length,
      fail: logs.filter((l) => l.type === "fail").length,
      success: logs.filter((l) => l.type === "success").length,
      ref: logs.filter((l) => l.type === "ref").length,
    }),
    [logs],
  );
  const items = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return logs.filter(
      (l) =>
        (type === "all" || l.type === type) &&
        (!ql || l.title.toLowerCase().includes(ql) || l.error_code?.toLowerCase().includes(ql) || l.keywords.some((k) => k.toLowerCase().includes(ql))),
    );
  }, [logs, type, q]);

  // 선택(타임라인 카드 또는 그래프 노드). 그래프에서 고른 노드가 현재 필터에 가려져 있으면 필터를 전체로 되돌린다.
  const select = (id: number) => {
    const node = logs.find((l) => l.id === id);
    if (node && type !== "all" && node.type !== type) setType("all");
    setEntryId(id);
  };

  // 선택 카드가 보이도록 스크롤 (DOM 동기화)
  useEffect(() => {
    cardRefs.current.get(entryId)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [entryId]);

  // 선택 변경 → 체인만 교체. 이전 체인을 유지한 채 바꿔 끼워 깜빡임 없음. URL은 replaceState로만 동기화.
  useEffect(() => {
    let alive = true;
    fetchChain(wsId, entryId).then((c) => {
      if (alive) startTransition(() => setChain(c));
    });
    const url = new URL(window.location.href);
    url.searchParams.set("entry", String(entryId));
    window.history.replaceState(null, "", url);
    return () => {
      alive = false;
    };
  }, [wsId, entryId]);

  return (
    <main className="grid grid-cols-[440px_1fr] items-start gap-6 p-8">
      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="font-bold text-ink">업무 로그 타임라인</h2>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="오류 코드 · 키워드 검색" className="h-9 w-56 pl-9" />
          </div>
        </div>
        <div className="mb-5 flex gap-2">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setType(f.key)}
              className={cn("flex h-8 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors", f.key === type ? "bg-primary-700 text-white" : f.cls)}
            >
              {f.label} {counts[f.key]}
            </button>
          ))}
        </div>
        <ol className="relative ml-3 border-l border-border pl-6">
          {items.map((l) => {
            const selected = l.id === entryId;
            return (
              <li key={l.id} ref={(el) => { if (el) cardRefs.current.set(l.id, el); else cardRefs.current.delete(l.id); }} className="relative mb-4">
                <span className={cn("absolute -left-[31px] top-5 size-3 rounded-full ring-4 ring-background", dotTone[l.type])} />
                <button type="button" onClick={() => select(l.id)} className="block w-full text-left">
                  <Card className={cn("gap-2 p-4 transition-all hover:bg-primary-50", selected && "bg-primary-50 ring-2 ring-primary-400")}>
                    <div className="flex items-center justify-between">
                      <TypeBadge type={l.type} />
                      <span className="text-xs text-ink-muted">{fmt(l.created_at)}</span>
                    </div>
                    <div className={cn("font-semibold text-ink", l.status === "deprecated" && "line-through opacity-60")}>{l.title}</div>
                    {/* 본문: 평소 2줄 미리보기, 선택 시 전문 + 정제 결과 */}
                    <p className={cn("text-sm leading-relaxed text-ink-muted", !selected && "line-clamp-2")}>{l.body}</p>
                    {selected && (
                      <div className="mt-1 flex flex-col gap-2 border-t border-border pt-3">
                        {l.resolution_summary && <p className="text-sm font-medium text-ink">{l.resolution_summary}</p>}
                        <div className="flex flex-wrap gap-1.5">
                          {l.error_code && <Chip tone="fail">{l.error_code}</Chip>}
                          {l.keywords.map((k) => <Chip key={k}>#{k}</Chip>)}
                          {l.refine_status !== "done" && <Chip tone="warn">{l.refine_status === "failed" ? "정제 실패" : "정제 전"}</Chip>}
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-ink-muted">
                      {l.author_name} · {l.path_label}
                      {l.status === "deprecated" && <span className="ml-2 rounded-full bg-warn-bg px-2 py-0.5 text-warn">폐기</span>}
                    </div>
                  </Card>
                </button>
              </li>
            );
          })}
          {items.length === 0 && <li className="py-10 text-center text-sm text-ink-muted">조건에 맞는 로그가 없습니다.</li>}
        </ol>
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
