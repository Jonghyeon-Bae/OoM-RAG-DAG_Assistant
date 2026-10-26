// 프로젝트 전용 래퍼. 기본 프리미티브는 shadcn(components/ui/*.tsx)을 쓴다.
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LogType } from "@/lib/types/domain";

export { cn };

export const typeLabel: Record<LogType, string> = { fail: "실패", success: "성공", ref: "참고" };

const typeTone: Record<LogType, string> = {
  fail: "bg-fail-bg text-fail",
  success: "bg-success-bg text-success",
  ref: "bg-ref-bg text-ref",
};

export function TypeBadge({ type, className }: { type: LogType; className?: string }) {
  return (
    <Badge className={cn("h-6 gap-1.5 rounded-md px-2.5 font-semibold", typeTone[type], className)}>
      <span className="size-1.5 rounded-full bg-current" />
      {typeLabel[type]}
    </Badge>
  );
}

export function Chip({
  tone = "neutral",
  className,
  children,
  title,
}: {
  tone?: "neutral" | "primary" | "warn" | "fail" | "dark";
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  const t = {
    neutral: "bg-ref-bg text-ref",
    primary: "bg-primary-100 text-primary-700",
    warn: "bg-warn-bg text-warn",
    fail: "bg-fail-bg text-fail",
    dark: "bg-primary-700 text-white",
  }[tone];
  return <Badge title={title} className={cn("h-7 rounded-full px-3 font-medium", t, className)}>{children}</Badge>;
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  // <label>로 감싸면 안의 첫 번째 버튼이 라벨 클릭에 반응한다(암묵적 연결). 입력 1개일 때만 htmlFor로 명시 연결.
  const Title = htmlFor ? "label" : "span";
  return (
    <div className="block">
      <Title htmlFor={htmlFor} className="mb-2 block text-sm text-ink-muted">{label}</Title>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-muted">{hint}</span>}
    </div>
  );
}

export function Avatar({ name, className, title }: { name: string; className?: string; title?: string }) {
  return (
    <span title={title ?? name} className={cn("flex size-10 items-center justify-center rounded-full bg-primary-700 font-bold text-white", className)}>
      {name[0]}
    </span>
  );
}
