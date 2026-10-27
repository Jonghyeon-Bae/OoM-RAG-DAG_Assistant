import { Suspense } from "react";
import { Chip, Avatar } from "@/components/ui";
import { getCurrentUser } from "@/lib/api/session";
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
        <Chip tone={ws.policy_enabled ? "primary" : "neutral"} className="hidden lg:inline-flex">{ws.policy_enabled ? "규정 + 해결 사례" : "해결 사례만"}</Chip>
        {right}
        <Suspense fallback={<Avatar name="·" />}><UserAvatar /></Suspense>
      </div>
    </header>
  );
}

// 쿠키(데모 세션) 기반 — 동적이므로 Suspense 안에서만 렌더
async function UserAvatar() {
  const u = await getCurrentUser();
  return <Avatar name={u.name} title={`${u.name} ${u.title}`} />;
}
