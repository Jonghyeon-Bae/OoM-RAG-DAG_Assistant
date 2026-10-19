"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const nav = [
  { href: "assistant", label: "AI 어시스턴트" },
  { href: "timeline", label: "트러블슈팅 타임라인" },
  { href: "logs/new", label: "업무로그 등록" },
  { href: "dashboard", label: "성과 대시보드" },
  { href: "documents", label: "규정 문서 관리", policyOnly: true },
];

export function Sidebar({ wsId, policyEnabled }: { wsId: number; policyEnabled: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-sidebar">
      <Link href="/" className="flex h-20 items-center gap-2.5 px-6">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary-700 text-sm font-bold text-white">O</span>
        <span className="text-lg font-bold text-ink">OoM Assist</span>
      </Link>
      <nav className="flex flex-col gap-1 px-4">
        {nav.map((item) => {
          const href = `/w/${wsId}/${item.href}`;
          const active = pathname.startsWith(href);
          const disabled = item.policyOnly && !policyEnabled;
          return (
            <Link
              key={item.href}
              href={disabled ? "#" : href}
              aria-disabled={disabled}
              className={cn(
                "flex h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium transition-colors",
                active ? "bg-primary-700 text-white" : "text-ink hover:bg-primary-100",
                disabled && "pointer-events-none opacity-40",
              )}
            >
              <span className={cn("size-2 rounded-full", active ? "bg-primary-200" : "bg-primary-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
