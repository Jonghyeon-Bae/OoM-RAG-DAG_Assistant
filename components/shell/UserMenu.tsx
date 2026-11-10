"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Check, UserRound } from "lucide-react";
import { Avatar, Chip, cn } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/api/auth";
import type { Me } from "@/lib/types/domain";
import { modeOf, modeShort, modeTone } from "@/lib/mode";

// 헤더 우측: 아바타 + 현재 워크스페이스 ▾ → 소속 워크스페이스 전환(현재 섹션 유지) · 로그아웃 (작업지시 B-3 / FE-008 §1 E)
export function UserMenu({ me, wsId }: { me: Me; wsId: number }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // /w/{id}/{section...} 에서 section 만 떼어 다른 워크스페이스의 같은 화면으로
  const section = pathname.replace(/^\/w\/\d+\/?/, "") || "timeline";
  const current = me.workspaces.find((w) => w.id === wsId);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2 hover:bg-primary-100" title={`${me.name}${me.title ? ` ${me.title}` : ""}`}>
        <Avatar name={me.name} />
        <span className="hidden text-sm text-ink md:inline">{me.name}</span>
        <ChevronDown className="size-3.5 text-ink-muted" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-72 rounded-xl border border-border bg-card p-2 shadow-lg">
          <div className="px-2 py-1.5 text-xs text-ink-muted">{me.name} · {me.employee_no}{me.title && ` · ${me.title}`}</div>
          <div className="mt-1 px-2 text-xs font-semibold text-ink-muted">워크스페이스</div>
          <ul className="mt-1 flex flex-col">
            {me.workspaces.map((w) => (
              <li key={w.id}>
                <Link role="menuitem" href={`/w/${w.id}/${section}`} onClick={() => setOpen(false)} className={cn("flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-primary-50", w.id === wsId && "bg-primary-50")}>
                  <Check className={cn("size-3.5", w.id === wsId ? "text-primary-700" : "opacity-0")} />
                  <span className="min-w-0 flex-1 truncate text-ink">{w.name}</span>
                  <Chip tone={modeTone(modeOf(w))} className="h-5 text-xs">{modeShort[modeOf(w)]}</Chip>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-border pt-2">
            <Link role="menuitem" href={`/w/${wsId}/me`} onClick={() => setOpen(false)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink hover:bg-primary-50"><UserRound className="size-3.5" /> 내 정보</Link>
            <button role="menuitem" type="button" onClick={() => logout()} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink hover:bg-primary-50"><LogOut className="size-3.5" /> 로그아웃</button>
          </div>
          {!current && <p className="px-2 pt-2 text-xs text-fail">이 워크스페이스의 멤버가 아닙니다</p>}
        </div>
      )}
    </div>
  );
}

export function LogoutButton() {
  return <Button type="button" variant="outline" size="lg" onClick={() => logout()}><LogOut className="size-4" /> 로그아웃</Button>;
}
