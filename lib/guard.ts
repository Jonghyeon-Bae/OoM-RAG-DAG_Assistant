import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/api/session";
import type { Me } from "@/lib/types/domain";

// 워크스페이스 화면 접근 가드 (FE-008 §1 D). 로그인 없음 → server.ts 가 /login, 게이트 미통과 → 게이트, 소속 아님 → 내 홈 부서.
// 레이아웃만으로는 부족하다: App Router 는 같은 /w/[wsId] 안에서 페이지를 옮길 때 레이아웃을 다시 실행하지 않는다.
// 그래서 열린 화면 아래에서 세션이 바뀌면(다른 계정 로그인 등) 게이트를 건너뛸 수 있었다 → 모든 페이지가 resolveWs 에서 이 가드를 돈다 (#093)
export async function requireWorkspace(wsId: number): Promise<Me> {
  const me = await getCurrentUser();
  if (me.consent_required) redirect("/gate/consent");
  if (me.must_change_password) redirect("/gate/password");
  if (!me.workspaces.some((w) => w.id === wsId)) {
    const home = me.workspace_id ?? me.workspaces[0]?.id;
    if (!home) redirect("/gate/no-workspace");
    redirect(`/w/${home}/timeline`);
  }
  return me;
}
