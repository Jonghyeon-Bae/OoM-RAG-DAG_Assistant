import { notFound, redirect } from "next/navigation";
import { getWorkspace } from "@/lib/api";
import { getCurrentUser } from "@/lib/api/session";
import { Sidebar } from "@/components/shell/Sidebar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ wsId: string }>;
}) {
  const { wsId } = await params;
  // 접근 가드 (FE-008 §1 D): 로그인 없음 → server.ts 가 "/login" 으로. 게이트 미통과 → 게이트. 소속 아님 → 내 첫 워크스페이스
  const me = await getCurrentUser();
  if (me.consent_required) redirect("/gate/consent");
  if (me.must_change_password) redirect("/gate/password");
  const id = Number(wsId);
  if (!me.workspaces.some((w) => w.id === id)) {
    const home = me.workspace_id ?? me.workspaces[0]?.id;
    if (!home) redirect("/gate/no-workspace");
    redirect(`/w/${home}/timeline`);
  }
  const ws = await getWorkspace(id);
  if (!ws) notFound();
  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <Sidebar wsId={ws.id} policyEnabled={ws.policy_enabled} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
