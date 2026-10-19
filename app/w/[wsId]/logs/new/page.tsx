import { Header } from "@/components/shell/Header";
import { Card } from "@/components/ui/card";
import { Chip, TypeBadge } from "@/components/ui";
import { LogForm } from "@/components/blocks/LogForm";
import { getLogs, getRecentLogs, getWeeklyCount } from "@/lib/api";
import { resolveWs } from "@/lib/ws";

export default async function NewLogPage({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await resolveWs(params);
  const [recent, weekly, { items }] = await Promise.all([getRecentLogs(ws.id, 5), getWeeklyCount(ws.id), getLogs(ws.id)]);
  const sample = items.find((l) => l.id === 101) ?? items[0];

  return (
    <>
      <Header title="업무로그 등록" subtitle="성공/실패/참고 로그를 등록하면 AI가 자동 정제·인덱싱합니다" ws={ws} right={<Chip>이번 주 등록 {weekly}건</Chip>} />
      <main className="grid grid-cols-[440px_1fr] items-start gap-6 p-8">
        <Card className="p-6">
          <h2 className="mb-5 font-bold text-ink">마이크로 업무로그 간편 등록</h2>
          <LogForm wsId={ws.id} candidates={items} />
          <h3 className="mb-3 mt-8 font-semibold text-ink">최근 등록 로그</h3>
          <ul className="flex flex-col gap-2.5">
            {recent.map((l) => (
              <li key={l.id} className="flex items-center gap-3 text-sm">
                <TypeBadge type={l.type} />
                <span className="truncate text-ink">{l.title}</span>
                <span className="ml-auto shrink-0 text-xs text-ink-muted">{l.author_name}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* B-34 정제 결과 패널 — 등록 후 pending → processing → done 으로 바뀌는 자리. 지금은 완료 샘플 */}
        <Card className="p-6">
          <div className="mb-5 flex items-center gap-3">
            <Chip tone="dark">LLM 자동 정제</Chip>
            <span className="text-sm text-ink-muted">에러 코드·키워드·해결 요약 자동 추출</span>
            <span className="ml-auto text-sm text-ink-muted">처리 1.8초</span>
          </div>
          <dl className="grid grid-cols-[88px_1fr] items-center gap-x-6 gap-y-4 text-sm">
            <dt className="text-ink-muted">에러 코드</dt>
            <dd>{sample?.error_code ? <Chip tone="fail" className="font-semibold">{sample.error_code}</Chip> : <span className="text-ink-muted">—</span>}</dd>
            <dt className="text-ink-muted">키워드</dt>
            <dd className="flex flex-wrap gap-2">{sample?.keywords.map((k) => <Chip key={k}>{k}</Chip>)}</dd>
            <dt className="text-ink-muted">해결 요약</dt>
            <dd className="font-semibold text-ink">{sample?.resolution_summary ?? "—"}</dd>
            <dt className="text-ink-muted">인덱싱</dt>
            <dd className="flex flex-wrap gap-2">
              <Chip tone="primary">pgvector 임베딩 완료</Chip>
              <Chip tone="primary">DAG 연결 {sample?.path_label}</Chip>
            </dd>
          </dl>
        </Card>
      </main>
    </>
  );
}
