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
    <header className="flex h-20 items-center justify-between border-b-2 border-primary-200 bg-card px-8">
      <div>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <Chip tone="primary">{ws.name}</Chip>
        <Chip tone={ws.policy_enabled ? "primary" : "neutral"}>{ws.policy_enabled ? "규정 + 해결 사례" : "해결 사례만"}</Chip>
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
