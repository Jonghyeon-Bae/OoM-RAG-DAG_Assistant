import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/api";
import { requireWorkspace } from "@/lib/guard";
import { accessOf } from "@/lib/access";
import { Sidebar } from "@/components/shell/Sidebar";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ wsId: string }>;
}) {
  const { wsId } = await params;
  // 첫 진입 가드. 같은 부서 안에서 페이지를 옮길 때는 레이아웃이 다시 돌지 않으므로 페이지(resolveWs)도 같은 가드를 돈다 (#093)
  // 사이드바의 관리자 메뉴는 첫 진입 때 값 — 역할이 바뀌면 다음 전체 진입 때 반영. 관리자 페이지 자체가 권한을 다시 본다
  const id = Number(wsId);
  const me = await requireWorkspace(id);
  const ws = await getWorkspace(id);
  if (!ws) notFound();
  return (
    <div className="flex min-h-screen flex-1 flex-col lg:flex-row">
      <Sidebar wsId={ws.id} policyEnabled={ws.policy_enabled} caseEnabled={ws.case_enabled} adminMenu={accessOf(me, ws.id).adminMenu} />
      <div className="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">{children}</div>
    </div>
  );
}
