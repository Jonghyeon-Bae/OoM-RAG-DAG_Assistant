import { Header } from "@/components/shell/Header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip, Field, TypeBadge, typeLabel, cn } from "@/components/ui";
import { getLogs, getRecentLogs, getWeeklyCount } from "@/lib/api";
import { resolveWs } from "@/lib/ws";
import type { LogType } from "@/lib/types/domain";

export default async function NewLogPage({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await resolveWs(params);
  const [recent, weekly, { items }] = await Promise.all([getRecentLogs(ws.id, 2), getWeeklyCount(ws.id), getLogs(ws.id)]);
  const sample = items.find((l) => l.id === 101) ?? items[0];
  const selectedType: LogType = "fail";

  return (
    <>
      <Header title="업무로그 등록" subtitle="성공/실패/참고 로그를 등록하면 AI가 자동 정제·인덱싱합니다" ws={ws} right={<Chip>이번 주 등록 {weekly}건</Chip>} />
      <main className="grid grid-cols-[420px_1fr] items-start gap-6 p-8">
        {/* B-30~B-35 */}
        <Card className="p-6">
          <h2 className="mb-5 font-bold text-ink">마이크로 업무로그 간편 등록</h2>
          <form className="flex flex-col gap-5">
            <Field label="로그 유형 (원클릭 태깅)">
              <div className="grid grid-cols-3 gap-2">
                {(["success", "fail", "ref"] as LogType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={t === selectedType}
                    className={cn(
                      "flex h-12 items-center justify-center gap-2 rounded-lg border text-sm font-semibold transition-colors",
                      t === selectedType ? "border-primary-700 bg-primary-700 text-white" : "border-border bg-card text-ink hover:bg-primary-100",
                    )}
                  >
                    <span className="size-2 rounded-full bg-current" />
                    {typeLabel[t]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="제목">
              <Input className="h-11" defaultValue={sample?.title} />
            </Field>
            <Field label="내용">
              <Textarea className="min-h-[120px]" defaultValue={sample?.body} />
            </Field>
            <Field label="상위 로그 연결 (DAG 부모)" hint="추천 목록에서 고르거나 검색해 직접 지정합니다. 직접 지정 시 경고가 표시됩니다.">
              <Input className="h-11" defaultValue="E-403 원격접속 인증 오류 · root.e403" />
            </Field>
            <div className="flex gap-3 pt-1">
              <Button variant="outline" size="lg" className="h-11 flex-1">초기화</Button>
              <Button size="lg" className="h-11 flex-[2]">등록하고 AI 정제</Button>
            </div>
          </form>
          <h3 className="mb-3 mt-8 font-semibold text-ink">최근 등록 로그</h3>
          <ul className="flex flex-col gap-2.5">
            {recent.map((l) => (
              <li key={l.id} className="flex items-center gap-3 text-sm">
                <TypeBadge type={l.type} />
                <span className="text-ink">{l.title}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* B-34 정제 결과 패널 */}
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
