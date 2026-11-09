import { Suspense } from "react";
import { Header } from "@/components/shell/Header";
import { MyPageView } from "@/components/blocks/account/MyPageView";
import { getCurrentUser } from "@/lib/api/session";
import { resolveWs } from "@/lib/ws";
import { daysUntil } from "@/lib/time";

async function Content({ params }: { params: Promise<{ wsId: string }> }) {
  const [ws, me] = await Promise.all([resolveWs(params), getCurrentUser()]);
  const daysLeft = me.password_expires_at ? await daysUntil(me.password_expires_at) : null;
  return (
    <>
      <Header title="내 정보" subtitle="계정·소속을 확인하고 비밀번호를 바꿉니다" ws={ws} />
      <MyPageView me={me} wsId={ws.id} daysLeft={daysLeft} />
    </>
  );
}

export default function MyPage(props: { params: Promise<{ wsId: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-ink-muted">불러오는 중…</div>}>
      <Content {...props} />
    </Suspense>
  );
}
