import { Chip } from "@/components/ui";

export function Header({
  title,
  subtitle,
  wsName,
  policyEnabled,
  right,
  userInitial = "배",
}: {
  title: string;
  subtitle: string;
  wsName: string;
  policyEnabled: boolean;
  right?: React.ReactNode;
  userInitial?: string;
}) {
  return (
    <header className="h-20 px-8 flex items-center justify-between border-b-2 border-primary-200 bg-surface">
      <div>
        <h1 className="text-xl font-bold text-ink">{title}</h1>
        <p className="text-sm text-ink-muted mt-0.5">{subtitle}</p>
      </div>
      <div className="flex items-center gap-3">
        <Chip tone="primary">{wsName}</Chip>
        <Chip tone={policyEnabled ? "primary" : "neutral"}>{policyEnabled ? "규정 결합 모드" : "DAG 단일 모드"}</Chip>
        {right}
        <span className="w-10 h-10 rounded-full bg-primary-700 text-white flex items-center justify-center font-bold">
          {userInitial}
        </span>
      </div>
    </header>
  );
}
