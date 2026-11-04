import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui";
import { getWorkspaces } from "@/lib/api";
import { LoginForm } from "@/components/blocks/LoginForm";

// 로그인: 사번·비밀번호 (작업지시 B-1). 워크스페이스 카드는 소개용 — GET /workspaces 는 로그인 전에도 열려 있다
export default async function LoginPage() {
  // 백엔드가 꺼져 있어도 로그인 화면은 떠야 한다 — 안내만 보여주고 폼은 그대로
  const workspaces = await getWorkspaces().catch(() => []);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-3xl p-8 md:p-10">
        <div className="mb-2 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-700 font-bold text-white">O</span>
          <h1 className="text-2xl font-bold text-ink">OoM Assist</h1>
        </div>
        <p className="mb-8 text-ink-muted">공식 규정 근거와 실무 해결 노하우를 한 번에 답변합니다.</p>
        <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <section aria-label="로그인">
            <LoginForm />
            <p className="mt-4 text-xs text-ink-muted">첫 로그인은 개인정보 처리 동의와 비밀번호 변경 뒤에 시작됩니다. 비밀번호를 여러 번 틀리면 잠시 잠깁니다.</p>
          </section>
          <section aria-label="워크스페이스 안내" className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-ink">워크스페이스</h2>
            <p className="text-xs text-ink-muted">부서 단위 작업 공간입니다. 로그인하면 내 소속 워크스페이스로 들어갑니다.</p>
            <ul className="flex flex-col gap-2">
              {workspaces.map((ws) => (
                <li key={ws.id} className="flex items-center justify-between rounded-lg border border-border bg-primary-50 px-3 py-2.5">
                  <span className="text-sm text-ink">{ws.name}</span>
                  <Chip tone={ws.policy_enabled ? "primary" : "neutral"} className="h-5 text-[11px]">{ws.policy_enabled ? "규정 + 해결 사례" : "해결 사례만"}</Chip>
                </li>
              ))}
              {workspaces.length === 0 && <li className="text-xs text-fail">서버에 연결할 수 없습니다. 백엔드가 켜져 있는지 확인해 주세요.</li>}
            </ul>
          </section>
        </div>
      </Card>
    </main>
  );
}
