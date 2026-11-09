import { Suspense } from "react";
import { Header } from "@/components/shell/Header";
import { AdminView } from "@/components/blocks/admin/AdminView";
import { getManageable, getMembers } from "@/lib/api";
import { getCurrentUser } from "@/lib/api/session";
import { resolveWs } from "@/lib/ws";
import { accessOf } from "@/lib/access";
import { Card } from "@/components/ui/card";

async function Content({ params }: { params: Promise<{ wsId: string }> }) {
  const [ws, me] = await Promise.all([resolveWs(params), getCurrentUser()]);
  const a = accessOf(me, ws.id);
  const header = <Header title="관리자" subtitle="멤버를 초대하고 부서가 무엇을 근거로 답할지 정합니다" ws={ws} />;
  if (!a.adminMenu) {
    return (<>{header}<main className="flex flex-1 items-start justify-center p-6 md:p-10"><Card className="max-w-lg p-8 text-sm text-ink-muted">이 워크스페이스의 관리자만 볼 수 있습니다.</Card></main></>);
  }
  const [members, manageable] = await Promise.all([a.wsAdmin ? getMembers(ws.id) : Promise.resolve(null), a.canConfigure ? getManageable() : Promise.resolve([])]);
  return (<>{header}<AdminView wsId={ws.id} wsName={ws.name} members={members} manageable={manageable} /></>);
}

export default function AdminPage(props: { params: Promise<{ wsId: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-ink-muted">불러오는 중…</div>}>
      <Content {...props} />
    </Suspense>
  );
}
