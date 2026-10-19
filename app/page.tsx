import Link from "next/link";
import { workspaces, demoUsers } from "@/lib/fixtures";
import { Card, Chip } from "@/components/ui";

// 로그인(데모): 계정·워크스페이스 선택만. 인증·세션 없음 (v1.1 SSO가 이 화면을 교체)
export default function LoginPage() {
  return (
    <main className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-3xl p-10">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-full bg-primary-700 text-white font-bold flex items-center justify-center">O</span>
          <h1 className="text-2xl font-bold text-ink">OoM Assist</h1>
        </div>
        <p className="text-ink-muted mb-8">공식 규정 근거와 실무 해결 노하우를 한 번에 답변합니다. 데모 계정을 선택해 시작하세요.</p>

        <div className="grid grid-cols-3 gap-4">
          {workspaces.map((ws) => (
            <section key={ws.id} className="border border-border rounded-card p-5 bg-primary-50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-ink">{ws.name}</h2>
                <Chip tone={ws.policy_enabled ? "primary" : "neutral"}>
                  {ws.policy_enabled ? "규정 결합" : "DAG 단일"}
                </Chip>
              </div>
              <ul className="flex flex-col gap-2">
                {demoUsers
                  .filter((u) => u.workspace_id === ws.id)
                  .map((u) => (
                    <li key={u.id}>
                      <Link
                        href={`/w/${ws.id}/assistant?u=${u.id}`}
                        className="flex items-center gap-3 bg-surface border border-border rounded-lg px-3 py-2.5 hover:border-primary-400 hover:bg-primary-100"
                      >
                        <span className="w-8 h-8 rounded-full bg-primary-200 text-primary-700 text-sm font-bold flex items-center justify-center">
                          {u.name[0]}
                        </span>
                        <span className="text-sm text-ink">{u.name}</span>
                        <span className="text-xs text-ink-muted ml-auto">{u.title}</span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
        <p className="text-xs text-ink-muted mt-8">v1.0 데모 — 비밀번호 없음. 워크스페이스가 곧 역할입니다.</p>
      </Card>
    </main>
  );
}
