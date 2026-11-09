import { Suspense } from "react";
import { Chip, Avatar } from "@/components/ui";
import { getCurrentUser } from "@/lib/api/session";
import { UserMenu } from "@/components/shell/UserMenu";
import { modeOf, modeLabel, modeTone } from "@/lib/mode";
import type { Workspace } from "@/lib/types/domain";

export function Header({
  title,
  subtitle,
  ws,
  right,
}: {
  title: string;
  subtitle: string;
  ws: Workspace;
  right?: React.ReactNode;
}) {
  return (
    <header className="z-30 flex min-h-16 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b-2 border-primary-200 bg-card px-4 py-3 md:sticky md:top-0 md:min-h-20 md:px-8">
      <div>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <p className="mt-0.5 hidden text-sm text-ink-muted sm:block">{subtitle}</p>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <Chip tone="primary" className="hidden sm:inline-flex">{ws.name}</Chip>
        <Chip tone={modeTone(modeOf(ws))} className="hidden lg:inline-flex">{modeLabel[modeOf(ws)]}</Chip>
        {right}
        <Suspense fallback={<Avatar name="·" />}><UserAvatar wsId={ws.id} /></Suspense>
      </div>
    </header>
  );
}

// 세션 쿠키 기반(GET /me) — 동적이므로 Suspense 안에서만 렌더. 전환·로그아웃 메뉴는 클라이언트
async function UserAvatar({ wsId }: { wsId: number }) {
  const u = await getCurrentUser();
  return <UserMenu me={u} wsId={wsId} />;
}
