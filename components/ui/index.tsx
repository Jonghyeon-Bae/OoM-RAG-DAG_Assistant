import Link from "next/link";
import type { LogType } from "@/lib/fixtures";
import { typeLabel } from "@/lib/fixtures";

type Cn = { className?: string };

export function cn(...parts: (string | false | undefined | null)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ className, children }: Cn & { children: React.ReactNode }) {
  return (
    <div className={cn("bg-surface border border-border rounded-card", className)}>{children}</div>
  );
}

export function Button({
  variant = "primary",
  className,
  children,
  href,
  type = "button",
}: Cn & {
  variant?: "primary" | "secondary" | "ghost";
  children: React.ReactNode;
  href?: string;
  type?: "button" | "submit";
}) {
  const base =
    "inline-flex items-center justify-center h-11 px-5 rounded-lg text-sm font-semibold transition-colors";
  const styles = {
    primary: "bg-primary-700 text-white hover:bg-[#27507a]",
    secondary: "bg-surface text-ink border border-border hover:bg-primary-100",
    ghost: "text-primary-700 hover:bg-primary-100",
  }[variant];
  if (href) {
    return (
      <Link href={href} className={cn(base, styles, className)}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} className={cn(base, styles, className)}>
      {children}
    </button>
  );
}

export function Chip({ className, children, tone = "neutral" }: Cn & { children: React.ReactNode; tone?: "neutral" | "primary" | "warn" }) {
  const t = {
    neutral: "bg-ref-bg text-ref",
    primary: "bg-primary-100 text-primary-700",
    warn: "bg-warn-bg text-warn",
  }[tone];
  return <span className={cn("inline-flex items-center h-7 px-3 rounded-full text-xs font-medium", t, className)}>{children}</span>;
}

export function TypeBadge({ type, className }: { type: LogType } & Cn) {
  const t = {
    fail: "bg-fail-bg text-fail",
    success: "bg-success-bg text-success",
    ref: "bg-ref-bg text-ref",
  }[type];
  return (
    <span className={cn("inline-flex items-center gap-1.5 h-6 px-2.5 rounded-md text-xs font-semibold", t, className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {typeLabel[type]}
    </span>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="block text-sm text-ink-muted mb-2">{label}</span>
      {children}
      {hint && <span className="block text-xs text-ink-muted mt-1.5">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-border bg-surface px-4 py-3 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-primary-400";
