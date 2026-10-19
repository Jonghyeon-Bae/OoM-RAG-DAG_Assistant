import { Chip, Avatar } from "@/components/ui";
import type { Workspace } from "@/lib/types/domain";

export function Header({
  title,
  subtitle,
  ws,
  right,
  userName = "배종현",
}: {
  title: string;
  subtitle: string;
  ws: Workspace;
  right?: React.ReactNode;
  userName?: string;
}) {
  return (
    <header className="flex h-20 items-center justify-between border-b-2 border-primary-200 bg-card px-8">
      <div>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <Chip tone="primary">{ws.name}</Chip>
        <Chip tone={ws.policy_enabled ? "primary" : "neutral"}>{ws.policy_enabled ? "규정 결합 모드" : "DAG 단일 모드"}</Chip>
        {right}
        <Avatar name={userName} />
      </div>
    </header>
  );
}
