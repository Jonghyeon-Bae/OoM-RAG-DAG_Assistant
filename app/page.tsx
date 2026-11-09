import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpenCheck, GitBranch, Gauge, LogIn } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui";
import { getWorkspaces } from "@/lib/api";
import { peekCurrentUser } from "@/lib/api/session";
import { nextPathFor } from "@/lib/api/auth";
import { modeOf, modeLabel, modeTone } from "@/lib/mode";

// 대문: 서비스 소개. 로그인된 사용자는 HTML 을 내기 전에 내 워크스페이스로 보낸다(점멸 없음). 로그인은 /login
export default async function HomePage() {
  const me = await peekCurrentUser();
  if (me) redirect(nextPathFor(me));
  const workspaces = await getWorkspaces().catch(() => []);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-3xl p-8 md:p-12">
        <div className="mb-3 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-primary-700 text-lg font-bold text-white">O</span>
          <h1 className="text-3xl font-bold text-ink">OoM Assist</h1>
        </div>
        <p className="max-w-xl text-ink-muted">사내 규정의 근거 조항과 동료가 실제로 해결한 기록을 <strong className="text-ink">한 답변</strong>으로 받습니다. 겪은 장애는 짧게 남기면 다음 사람의 근거가 됩니다.</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/login" className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary-700 px-5 text-sm font-semibold text-white hover:bg-primary-800"><LogIn className="size-4" /> 로그인</Link>
          <span className="text-xs text-ink-muted">사번 · 비밀번호</span>
        </div>

        <dl className="mt-10 grid gap-4 sm:grid-cols-3">
          <Feature icon={<BookOpenCheck className="size-5" />} title="규정은 조항까지" body="답마다 어느 규정 몇 조인지 출처가 붙고, 원문을 바로 펼쳐 봅니다." />
          <Feature icon={<GitBranch className="size-5" />} title="해결은 흐름으로" body="실패 → 시도 → 해결이 이어진 기록을 타임라인으로 봅니다. 누가 어떻게 풀었는지가 남습니다." />
          <Feature icon={<Gauge className="size-5" />} title="빈 곳이 보인다" body="근거 없이 끝난 질문과 자주 쓰인 기록을 대시보드에서 봅니다. 다음에 무엇을 남길지 알 수 있습니다." />
        </dl>

        <section className="mt-10">
          <h2 className="text-sm font-semibold text-ink">워크스페이스</h2>
          <p className="mt-1 text-xs text-ink-muted">부서 단위 작업 공간입니다. 로그인하면 내 소속 워크스페이스로 들어갑니다.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {workspaces.map((ws) => (
              <li key={ws.id} className="flex items-center justify-between rounded-lg border border-border bg-primary-50 px-3 py-2.5">
                <span className="text-sm text-ink">{ws.name}</span>
                <Chip tone={modeTone(modeOf(ws))} className="h-5 text-[11px]">{modeLabel[modeOf(ws)]}</Chip>
              </li>
            ))}
            {workspaces.length === 0 && <li className="text-xs text-fail">서버에 연결할 수 없습니다. 백엔드가 켜져 있는지 확인해 주세요.</li>}
          </ul>
        </section>
      </Card>
    </main>
  );
}

function Feature({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-primary-50 p-4">
      <dt className="flex items-center gap-2 font-semibold text-ink"><span className="text-primary-700">{icon}</span>{title}</dt>
      <dd className="mt-2 text-sm text-ink-muted">{body}</dd>
    </div>
  );
}
