import { Suspense } from "react";
import Link from "next/link";
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
    <header className="sticky top-0 z-30 flex min-h-14 items-center justify-between gap-x-3 border-b-2 border-primary-200 bg-card px-3 py-2 md:px-6 lg:min-h-20 lg:px-8 lg:py-3">
      {/* 휴대폰·태블릿: 로고 줄을 따로 두지 않고 헤더 한 줄에 합친다(D-008) */}
      <Link href="/" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-700 text-sm font-bold text-white lg:hidden" title="OoM Assist">O</Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg font-bold text-ink lg:text-xl">{title}</h1>
        <p className="mt-0.5 hidden truncate text-sm text-ink-muted md:block">{subtitle}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 md:gap-3">
        <Chip tone="primary" className="hidden md:inline-flex">{ws.name}</Chip>
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
