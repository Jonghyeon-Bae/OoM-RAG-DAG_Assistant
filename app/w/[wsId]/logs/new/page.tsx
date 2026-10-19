import { Header } from "@/components/shell/Header";
import { Button, Card, Chip, Field, TypeBadge, inputClass, cn } from "@/components/ui";
import { recentLogs, refineSample, typeLabel, type LogType } from "@/lib/fixtures";
import { getWs } from "@/lib/ws";

const selectedType: LogType = "fail";

export default async function NewLogPage({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await getWs(params);
  return (
    <>
      <Header
        title="업무로그 등록"
        subtitle="성공/실패/참고 로그를 등록하면 AI가 자동 정제·인덱싱합니다"
        wsName={ws.name}
        policyEnabled={ws.policy_enabled}
        right={<Chip>이번 주 등록 17건</Chip>}
      />
      <main className="p-8 grid grid-cols-[420px_1fr] gap-6 items-start">
        {/* B-30~B-35 등록 폼 */}
        <Card className="p-6">
          <h2 className="font-bold text-ink mb-5">마이크로 업무로그 간편 등록</h2>
          <form className="flex flex-col gap-5">
            <Field label="로그 유형 (원클릭 태깅)">
              <div className="grid grid-cols-3 gap-2">
                {(["success", "fail", "ref"] as LogType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={t === selectedType}
                    className={cn(
                      "h-12 rounded-lg border text-sm font-semibold flex items-center justify-center gap-2",
                      t === selectedType
                        ? "bg-primary-700 border-primary-700 text-white"
                        : "bg-surface border-border text-ink hover:bg-primary-100",
                    )}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" />
                    {typeLabel[t]}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="제목">
              <input className={inputClass} defaultValue="VPN 접속 시 E-403 반복 발생" />
            </Field>
            <Field label="내용">
              <textarea
                className={cn(inputClass, "min-h-[120px] resize-y")}
                defaultValue="오전 9시 이후 원격접속 시 E-403이 발생. 토큰 갱신 배치가 중단된 것을 확인하고 배치 주기를 30분으로 변경함."
              />
            </Field>
            <Field label="상위 로그 연결 (DAG 부모)" hint="추천 목록에서 고르거나 검색해 직접 지정합니다. 직접 지정 시 경고가 표시됩니다.">
              <input className={inputClass} defaultValue="E-403 원격접속 인증 오류 · root.e403" />
            </Field>
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" className="flex-1">초기화</Button>
              <Button className="flex-[2]">등록하고 AI 정제</Button>
            </div>
          </form>

          {/* B-35 최근 등록 로그 */}
          <h3 className="font-semibold text-ink mt-8 mb-3">최근 등록 로그</h3>
          <ul className="flex flex-col gap-2.5">
            {recentLogs.map((l) => (
              <li key={l.id} className="flex items-center gap-3 text-sm">
                <TypeBadge type={l.type} />
                <span className="text-ink">{l.title}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* B-34 정제 결과 패널 */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <span className="h-7 px-3 rounded-full bg-primary-700 text-white text-xs font-semibold flex items-center">LLM 자동 정제</span>
            <span className="text-sm text-ink-muted">에러 코드·키워드·해결 요약 자동 추출</span>
            <span className="ml-auto text-sm text-ink-muted">처리 {(refineSample.elapsed_ms / 1000).toFixed(1)}초</span>
          </div>
          <dl className="grid grid-cols-[88px_1fr] gap-y-4 gap-x-6 text-sm items-center">
            <dt className="text-ink-muted">에러 코드</dt>
            <dd><span className="inline-flex h-7 px-3 items-center rounded-full bg-fail-bg text-fail font-semibold text-xs">{refineSample.error_code}</span></dd>
            <dt className="text-ink-muted">키워드</dt>
            <dd className="flex flex-wrap gap-2">{refineSample.keywords.map((k) => <Chip key={k}>{k}</Chip>)}</dd>
            <dt className="text-ink-muted">해결 요약</dt>
            <dd className="font-semibold text-ink">{refineSample.resolution_summary}</dd>
            <dt className="text-ink-muted">인덱싱</dt>
            <dd className="flex flex-wrap gap-2">
              <Chip tone="primary">pgvector 임베딩 완료</Chip>
              <Chip tone="primary">DAG 연결 {refineSample.parent_path}</Chip>
            </dd>
          </dl>
        </Card>
      </main>
    </>
  );
}
