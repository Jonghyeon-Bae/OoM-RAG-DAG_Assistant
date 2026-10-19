"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Archive, RotateCcw, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, TypeBadge, cn } from "@/components/ui";
import { fetchLog, fetchRecentLogs, patchStatus, postRefine } from "@/lib/api/client";
import type { LogNode, RefineStatus } from "@/lib/types/domain";

const stages: { key: RefineStatus; label: string }[] = [
  { key: "pending", label: "접수" },
  { key: "processing", label: "LLM 정제·임베딩" },
  { key: "done", label: "검색 가능" },
];
const order: Record<RefineStatus, number> = { pending: 0, processing: 1, done: 2, failed: 2 };

function Stepper({ status }: { status: RefineStatus }) {
  return (
    <ol className="flex items-center gap-2 text-xs">
      {stages.map((s, i) => {
        const reached = order[status] >= i;
        const current = order[status] === i && status !== "done";
        return (
          <li key={s.key} className="flex items-center gap-2">
            <span className={cn("flex h-7 items-center gap-1.5 rounded-full px-3 font-medium", reached ? "bg-primary-700 text-white" : "bg-ref-bg text-ref", status === "failed" && i === 2 && "bg-fail text-white")}>
              {current && <Loader2 className="size-3 animate-spin" />}
              {status === "failed" && i === 2 ? "실패" : s.label}
            </span>
            {i < stages.length - 1 && <span className={cn("h-px w-6", reached ? "bg-primary-400" : "bg-border")} />}
          </li>
        );
      })}
    </ol>
  );
}

function Result({ n }: { n: LogNode }) {
  return (
    <dl className="grid grid-cols-[72px_1fr] items-center gap-x-4 gap-y-2.5 text-sm">
      <dt className="text-ink-muted">에러 코드</dt>
      <dd>{n.error_code ? <Chip tone="fail" className="font-semibold">{n.error_code}</Chip> : <span className="text-ink-muted">—</span>}</dd>
      <dt className="text-ink-muted">키워드</dt>
      <dd className="flex flex-wrap gap-1.5">{n.keywords.length ? n.keywords.map((k) => <Chip key={k}>#{k}</Chip>) : <span className="text-ink-muted">—</span>}</dd>
      <dt className="text-ink-muted">요약</dt>
      <dd className="font-medium text-ink">{n.resolution_summary ?? "—"}</dd>
      <dt className="text-ink-muted">인덱싱</dt>
      <dd className="flex flex-wrap gap-1.5">
        {n.refine_status === "done" ? (
          <>
            <Chip tone="primary">pgvector 임베딩 완료</Chip>
            <Chip tone="primary">DAG {n.path_label}</Chip>
          </>
        ) : (
          <span className="text-ink-muted">정제 완료 후 적재</span>
        )}
      </dd>
    </dl>
  );
}

export function RefinePanel({ wsId, currentId, initialRecent }: { wsId: number; currentId: number | null; initialRecent: LogNode[] }) {
  const [current, setCurrent] = useState<LogNode | null>(null);
  const [recent, setRecent] = useState<LogNode[]>(initialRecent);
  const [busyId, setBusyId] = useState<number | null>(null);

  // 방금 등록한 로그를 2초 폴링. done/failed에서 중단하고 최근 목록 갱신. (외부 시스템 구독 → 콜백 내 setState)
  useEffect(() => {
    if (!currentId) return;
    let stop = false;
    const tick = async () => {
      const n = await fetchLog(wsId, currentId);
      if (stop) return;
      if (n) setCurrent(n);
      if (n && (n.refine_status === "done" || n.refine_status === "failed")) {
        fetchRecentLogs(wsId, 8).then((r) => !stop && setRecent(r));
        return;
      }
      timer = setTimeout(tick, 1000);
    };
    let timer = setTimeout(tick, 0);
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [wsId, currentId]);

  const act = async (id: number, fn: () => Promise<unknown>) => {
    setBusyId(id);
    await fn();
    const r = await fetchRecentLogs(wsId, 8);
    setRecent(r);
    if (current?.id === id) setCurrent(r.find((x) => x.id === id) ?? current);
    setBusyId(null);
  };
  const refine = (id: number) => act(id, () => postRefine(wsId, id));
  const deprecate = (id: number) => act(id, () => patchStatus(wsId, id, "deprecated", "사용자 폐기"));
  const restore = (id: number) => act(id, () => patchStatus(wsId, id, "active"));

  return (
    <div className="flex flex-col gap-6">
      {/* 현재 등록 건의 정제 진행 */}
      <Card className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <Chip tone="dark">LLM 자동 정제</Chip>
          <span className="text-sm text-ink-muted">등록한 메모를 에러 코드·키워드·요약으로 바꿔 검색 가능한 지식으로 만듭니다</span>
        </div>
        {current ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <TypeBadge type={current.type} />
                <span className="truncate font-semibold text-ink">{current.title}</span>
              </div>
              <Stepper status={current.refine_status} />
            </div>
            <Result n={current} />
            {current.refine_status === "done" && (
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                <Link href={`/w/${wsId}/timeline?entry=${current.id}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary-700 px-3 text-sm font-semibold text-white hover:bg-[#27507a]">
                  <ExternalLink className="size-4" /> 타임라인에서 보기
                </Link>
                <Button variant="outline" size="lg" onClick={() => refine(current.id)} disabled={busyId === current.id} title="원본은 그대로 두고 AI 정제만 다시 실행"><RefreshCw className="size-4" /> 재정제</Button>
                <Button variant="outline" size="lg" onClick={() => deprecate(current.id)} disabled={busyId === current.id} title="검색에서 제외 (원본 보존, 복원 가능)" className="text-warn hover:bg-warn-bg hover:text-warn"><Archive className="size-4" /> 폐기</Button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-ink-muted">
            왼쪽에서 로그를 등록하면 접수 → LLM 정제·임베딩 → 검색 가능 순서로 진행 상황과 추출 결과가 여기에 표시됩니다.
          </div>
        )}
      </Card>

      {/* 최근 정제 결과 타임라인 */}
      <Card className="p-6">
        <h3 className="mb-4 font-semibold text-ink">최근 정제 결과</h3>
        <ol className="relative ml-2 border-l border-border pl-5">
          {recent.map((n) => (
            <li key={n.id} className="relative mb-4 last:mb-0">
              <span className={cn("absolute -left-[26px] top-2 size-2.5 rounded-full ring-4 ring-card", n.type === "fail" ? "bg-fail" : n.type === "success" ? "bg-success" : "bg-ref")} />
              <div className={cn("flex flex-col gap-1.5", n.status === "deprecated" && "opacity-60")}>
                <div className="flex items-center gap-2">
                  <TypeBadge type={n.type} />
                  <Link href={`/w/${wsId}/timeline?entry=${n.id}`} className={cn("truncate text-sm font-semibold text-ink hover:underline", n.status === "deprecated" && "line-through")}>{n.title}</Link>
                  <span className="ml-auto shrink-0 text-xs text-ink-muted">{n.author_name}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  {n.refine_status === "done" ? <Chip tone="primary">검색 가능</Chip> : n.refine_status === "failed" ? <Chip tone="fail">정제 실패</Chip> : <Chip tone="warn">{n.refine_status === "processing" ? "정제 중" : "대기"}</Chip>}
                  {n.status === "deprecated" && <Chip tone="warn">폐기</Chip>}
                  {n.error_code && <Chip tone="fail">{n.error_code}</Chip>}
                  {n.keywords.slice(0, 3).map((k) => <Chip key={k}>#{k}</Chip>)}
                  <span className="ml-auto flex gap-1.5">
                    <Button variant="outline" size="xs" onClick={() => refine(n.id)} disabled={busyId === n.id} title="원본은 그대로 두고 AI 정제만 다시 실행">
                      <RefreshCw className="size-3" /> 재정제
                    </Button>
                    {n.status === "deprecated" ? (
                      <Button variant="outline" size="xs" onClick={() => restore(n.id)} disabled={busyId === n.id} title="검색에 다시 포함">
                        <RotateCcw className="size-3" /> 복원
                      </Button>
                    ) : (
                      <Button variant="outline" size="xs" onClick={() => deprecate(n.id)} disabled={busyId === n.id} title="검색에서 제외 (원본 보존, 복원 가능)" className="text-warn hover:bg-warn-bg hover:text-warn">
                        <Archive className="size-3" /> 폐기
                      </Button>
                    )}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
