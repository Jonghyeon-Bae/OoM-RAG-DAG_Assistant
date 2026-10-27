import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui";
import { getUsers, getWorkspaces } from "@/lib/api";

// 로그인(데모): 계정·워크스페이스 선택만. 인증·세션 없음 (v1.1 SSO가 이 화면을 교체)
export default async function LoginPage() {
  const [workspaces, users] = await Promise.all([getWorkspaces(), getUsers()]);
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-3xl p-10">
        <div className="mb-2 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-700 font-bold text-white">O</span>
          <h1 className="text-2xl font-bold text-ink">OoM Assist</h1>
        </div>
        <p className="mb-8 text-ink-muted">공식 규정 근거와 실무 해결 노하우를 한 번에 답변합니다. 데모 계정을 선택해 시작하세요.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          {workspaces.map((ws) => (
            <section key={ws.id} className="rounded-xl border border-border bg-primary-50 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold text-ink">{ws.name}</h2>
                <Chip tone={ws.policy_enabled ? "primary" : "neutral"}>{ws.policy_enabled ? "규정 + 해결 사례" : "해결 사례만"}</Chip>
              </div>
              <ul className="flex flex-col gap-2">
                {users
                  .filter((u) => u.workspace_id === ws.id)
                  .map((u) => (
                    <li key={u.id}>
                      <Link
                        href={`/api/mock/session?u=${u.id}&next=/w/${ws.id}/timeline`}
                        className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:border-primary-400 hover:bg-primary-100"
                      >
                        <span className="flex size-8 items-center justify-center rounded-full bg-primary-200 text-sm font-bold text-primary-700">{u.name[0]}</span>
                        <span className="text-sm text-ink">{u.name}</span>
                        <span className="ml-auto text-xs text-ink-muted">{u.title}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="mt-8 text-xs text-ink-muted">v1.0 데모 — 비밀번호 없음. 워크스페이스가 곧 역할입니다.</p>
      </Card>
    </main>
  );
}
