import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Chip, TypeBadge, cn } from "@/components/ui";
import type { DashboardSummary, Intent } from "@/lib/types/domain";

const intentLabel: Record<Intent, string> = { policy: "규정 확인", troubleshoot: "장애 해결", both: "규정 + 해결 사례" };
const fmtHours = (h: number) => (h < 1 ? `${Math.round(h * 60)}분` : h < 48 ? `${h.toFixed(1)}시간` : `${(h / 24).toFixed(1)}일`);
const fmtAt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

function Kpi({ label, value, sub, subTone = "neutral", sample = false }: { label: string; value: React.ReactNode; sub?: string; subTone?: "neutral" | "fail" | "primary"; sample?: boolean }) {
  return (
    <Card className="gap-2 p-6">
      <div className="flex items-center justify-between text-sm text-ink-muted">
        <span>{label}</span>
        {sample && <Chip tone="warn" className="h-5 text-[11px]" title="실측 전 예시값. E6 평가·실험 후 교체">예시</Chip>}
      </div>
      <div className="text-3xl font-bold tracking-tight text-ink">{value}</div>
      {sub && <Chip tone={subTone} className="w-fit">{sub}</Chip>}
    </Card>
  );
}

// B-51: 유형별 탐색 시간 before/after 막대 (CSS). 축은 공통 최대값 기준.
function CompareBars({ rows }: { rows: DashboardSummary["search_time"]["by_intent"] }) {
  const max = Math.max(...rows.flatMap((r) => [r.before_min, r.after_min]), 1);
  const w = (v: number) => `${Math.max(2, (v / max) * 100)}%`;
  return (
    <div className="flex flex-col gap-5">
      {rows.map((r) => (
        <div key={r.intent} className="grid grid-cols-[72px_1fr] items-center gap-4">
          <div className="text-sm text-ink">{intentLabel[r.intent]}</div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <div className="h-3 rounded-full bg-ref-bg" style={{ width: w(r.before_min) }} />
              <span className="text-xs text-ink-muted">{r.before_min}분</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 rounded-full bg-primary-700" style={{ width: w(r.after_min) }} />
              <span className="text-xs font-semibold text-ink">{r.after_min}분</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DashboardView({ wsId, data }: { wsId: number; data: DashboardSummary }) {
  const { search_time: st, eval: ev, logs, queries, no_evidence: noEv, resolve_time: rt, reused } = data;
  const reduce = Math.round((1 - st.after_min / st.before_min) * 100);
  const fmt = (v: number | null) => (v == null ? "—" : v.toFixed(2));
  return (
    <main className="flex flex-col gap-6 p-4 md:p-6 xl:p-8">
      {/* B-50 KPI */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="평균 정보 탐색 시간" value={<>{st.before_min}<span className="mx-1 text-ink-muted">→</span>{st.after_min}분</>} sub={`-${reduce}% 단축`} subTone="primary" sample={data.is_sample} />
        <Kpi label="Faithfulness" value={fmt(ev.faithfulness)} sub="답변이 근거에 충실한 정도" sample={data.is_sample} />
        <Kpi label="Answer Relevance" value={fmt(ev.answer_relevance)} sub="질문에 맞는 답인지" sample={data.is_sample} />
        <Kpi label="등록된 업무 로그" value={`${logs.total}건`} sub={`이번 주 +${logs.week}`} subTone="primary" />
      </div>

      {/* R-24 2차: 이용 현황 — 세션·로그 실시간 집계 (UX-002 1~3) */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="gap-2 p-6">
          <div className="text-sm text-ink-muted">이번 주 질문</div>
          <div className="text-3xl font-bold tracking-tight text-ink">{queries.week}건<span className="ml-2 text-sm font-normal text-ink-muted">누적 {queries.total}</span></div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {queries.by_intent.map((b) => <Chip key={b.intent} tone={b.count ? "primary" : "neutral"} className="h-5 text-[11px]">{intentLabel[b.intent]} {b.count}</Chip>)}
          </div>
        </Card>
        <Card className="gap-2 p-6">
          <div className="flex items-center justify-between text-sm text-ink-muted"><span>평균 해결 소요</span><span className="text-xs">완료 {rt.sample}건 중앙값</span></div>
          <div className="text-3xl font-bold tracking-tight text-ink">{rt.median_hours === null ? "—" : fmtHours(rt.median_hours)}</div>
          <Chip className="w-fit" title="장애 건 첫 기록 시각 → 완료 처리 시각">첫 기록 → 완료</Chip>
        </Card>
        <Card className="gap-2 p-6">
          <div className="text-sm text-ink-muted">근거 없이 끝난 질문</div>
          <div className={cn("text-3xl font-bold tracking-tight", noEv.rate && noEv.rate >= 30 ? "text-fail" : "text-ink")}>{noEv.rate === null ? "—" : `${noEv.rate}%`}</div>
          <Chip tone={noEv.rate && noEv.rate >= 30 ? "fail" : "neutral"} className="w-fit" title="찾은 규정·해결 사례가 하나도 없어 답을 못 한 비율 — 다음에 등록할 것을 가리킵니다">지식의 빈 곳</Chip>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 빈 곳 (UX-002 1) */}
        <Card className="gap-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-ink">답을 못 한 질문</h2>
            <span className="text-xs text-ink-muted">최근 5건 · 다음에 등록할 것</span>
          </div>
          {noEv.recent.length === 0 ? <p className="text-sm text-ink-muted">아직 없습니다. 모든 질문에 근거가 있었습니다.</p> : (
            <ul className="divide-y divide-border">
              {noEv.recent.map((q) => (
                <li key={q.session_id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-20 shrink-0 text-[11px] tabular-nums text-ink-muted">{fmtAt(q.created_at)}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">{q.query}</span>
                  <Chip className="h-5 shrink-0 text-[11px]">{intentLabel[q.intent]}</Chip>
                  <Link href={`/w/${wsId}/logs/new`} className="shrink-0 text-xs font-medium text-primary-700 hover:underline">로그 등록</Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {/* 많이 쓰인 사례 (UX-002 4) */}
        <Card className="gap-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-ink">답변에 많이 쓰인 기록</h2>
            <span className="text-xs text-ink-muted">인용 횟수 Top 5 · 작성자</span>
          </div>
          {reused.length === 0 ? <p className="text-sm text-ink-muted">아직 인용된 기록이 없습니다. 질문이 쌓이면 여기에 나타납니다.</p> : (
            <ol className="divide-y divide-border">
              {reused.map((r, i) => (
                <li key={r.node_id} className="flex items-center gap-3 py-2 text-sm">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-primary-700">{i + 1}</span>
                  <TypeBadge type={r.type} />
                  <Link href={`/w/${wsId}/timeline?entry=${r.node_id}`} className="min-w-0 flex-1 truncate text-ink hover:underline">{r.title}</Link>
                  <span className="shrink-0 text-xs text-ink-muted">{r.author_name}</span>
                  <Chip tone="primary" className="h-5 shrink-0 text-[11px]">{r.count}회</Chip>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* B-51 */}
        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-bold text-ink">질의 유형별 정보 탐색 시간 비교</h2>
            <div className="flex items-center gap-4 text-xs text-ink-muted">
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-ref-bg" /> 기존 검색</span>
              <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary-700" /> AI Assistant</span>
            </div>
          </div>
          <CompareBars rows={st.by_intent} />
          {data.is_sample && <p className="mt-6 text-xs text-ink-muted">※ 예시 데이터입니다. 측정 방법: 4명이 같은 과제 10건을 기존 검색과 AI Assistant로 각각 수행해 과제 시작~정답 확인 시간을 비교(E6, 팀 내부 파일럿). 실측 후 교체됩니다.</p>}
        </Card>

        {/* 타임라인·등록과 이어지는 운영 현황 (실시간 집계) */}
        <Card className="gap-4 p-6">
          <h2 className="font-bold text-ink">장애 건 현황</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/w/${wsId}/timeline`} className="rounded-xl bg-warn-bg/60 p-4 hover:bg-warn-bg">
              <div className="text-xs text-warn">진행 중</div>
              <div className="text-2xl font-bold text-ink">{logs.open_roots}건</div>
            </Link>
            <Link href={`/w/${wsId}/timeline?resolved=1`} className="rounded-xl bg-success-bg/60 p-4 hover:bg-success-bg">
              <div className="text-xs text-success">완료</div>
              <div className="text-2xl font-bold text-ink">{logs.resolved_roots}건</div>
            </Link>
          </div>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between"><dt className="text-ink-muted">AI 정리 실패</dt><dd className={cn("font-semibold", logs.refine_failed ? "text-fail" : "text-ink")}>{logs.refine_failed}건</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">답변 만족</dt><dd className="font-semibold text-ink">{data.feedback.up + data.feedback.down ? `${Math.round((data.feedback.up / (data.feedback.up + data.feedback.down)) * 100)}%` : "측정 전"}</dd></div>
            <div className="flex justify-between"><dt className="text-ink-muted">첫 응답 시간</dt><dd className="font-semibold text-ink">{data.latency_ms.first_token ? `${(data.latency_ms.first_token / 1000).toFixed(1)}초` : "측정 전"}</dd></div>
          </dl>
          <Link href={`/w/${wsId}/logs/new`} className="mt-auto inline-flex h-10 items-center justify-center rounded-lg bg-primary-700 text-sm font-semibold text-white hover:bg-[#27507a]">업무로그 등록</Link>
        </Card>
      </div>
    </main>
  );
}
