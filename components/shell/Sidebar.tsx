"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { nav } from "@/lib/fixtures";
import { cn } from "@/components/ui";

export function Sidebar({ wsId, policyEnabled }: { wsId: number; policyEnabled: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-border bg-surface flex flex-col">
      <Link href="/" className="flex items-center gap-2.5 px-6 h-20">
        <span className="w-8 h-8 rounded-full bg-primary-700 text-white text-sm font-bold flex items-center justify-center">O</span>
        <span className="text-lg font-bold text-ink">OoM Assist</span>
      </Link>
      <nav className="px-4 flex flex-col gap-1">
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
                "flex items-center gap-3 h-12 px-4 rounded-xl text-sm font-medium",
                active ? "bg-primary-700 text-white" : "text-ink hover:bg-primary-100",
                disabled && "opacity-40 pointer-events-none",
              )}
            >
              <span className={cn("w-2 h-2 rounded-full", active ? "bg-primary-200" : "bg-primary-400")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
