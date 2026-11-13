"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Bot, GitBranch, SquarePen, LayoutDashboard, FileText, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// policyOnly = 규정 사용 부서만, caseOnly = 사례 사용 부서만 (FE-012 P0-3, D-1 기본안: 비활성 + 이유 표시)
// 배치(#102, TR-001 §8): ~1023 하단 탭 바 / 1024~1279 아이콘 레일 72px / 1280~ 이름 포함 240px
const nav: { href: string; label: string; short: string; icon: LucideIcon; policyOnly?: boolean; caseOnly?: boolean; pending?: boolean; adminOnly?: boolean }[] = [
  { href: "assistant", label: "AI 어시스턴트", short: "어시스턴트", icon: Bot },
  { href: "timeline", label: "트러블슈팅 타임라인", short: "타임라인", icon: GitBranch, caseOnly: true },
  { href: "logs/new", label: "업무로그 등록", short: "등록", icon: SquarePen, caseOnly: true },
  { href: "dashboard", label: "성과 대시보드", short: "대시보드", icon: LayoutDashboard },
  { href: "documents", label: "규정 문서 관리", short: "문서", icon: FileText, policyOnly: true }, // 백엔드 #37·#44 (11/13 연결, #109)
  { href: "admin", label: "관리자", short: "관리", icon: Settings, adminOnly: true }, // 권한 없으면 메뉴 자체를 숨긴다(D-5)
];

// 누른 메뉴가 열리는 동안 표시 — 휴대폰에서 탭이 먹었는지 바로 보이게
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden className="absolute inset-x-2 top-0 h-0.5 animate-pulse rounded-full bg-primary-700" /> : null;
}

export function Sidebar({ wsId, policyEnabled, caseEnabled, adminMenu }: { wsId: number; policyEnabled: boolean; caseEnabled: boolean; adminMenu: boolean }) {
  const pathname = usePathname();
  const items = nav
    .filter((item) => !item.adminOnly || adminMenu)
    .map((item) => {
      const href = `/w/${wsId}/${item.href}`;
      const why = item.pending ? "준비 중입니다" : item.policyOnly && !policyEnabled ? "이 워크스페이스는 규정을 쓰지 않습니다" : item.caseOnly && !caseEnabled ? "이 워크스페이스는 해결 사례를 쓰지 않습니다" : null;
      return { ...item, href, active: pathname.startsWith(href), why };
    });
  return (
    <>
      <aside className="sticky top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-border bg-sidebar lg:flex lg:w-[72px] xl:w-60">
        <Link href="/" className="flex h-20 items-center justify-center gap-2.5 xl:justify-start xl:px-6" title="OoM Assist">
          <span className="flex size-8 items-center justify-center rounded-full bg-primary-700 text-sm font-bold text-white">O</span>
          <span className="hidden text-lg font-bold text-ink xl:inline">OoM Assist</span>
        </Link>
        <nav className="flex flex-col gap-1 px-3 xl:px-4">
          {items.map((item) => {
            const disabled = item.why !== null;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={disabled ? "#" : item.href}
                aria-disabled={disabled}
                aria-current={item.active ? "page" : undefined}
                title={item.why ?? item.label}
                onClick={disabled ? (e) => e.preventDefault() : undefined}
                className={cn(
                  "relative flex h-12 items-center justify-center gap-3 rounded-xl text-sm font-medium transition-colors xl:justify-start xl:px-4",
                  item.active ? "bg-primary-700 text-white" : "text-ink hover:bg-primary-100",
                  disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
                )}
              >
                <Icon className="size-5 shrink-0" />
                {!disabled && <Pending />}
                <span className="hidden whitespace-nowrap xl:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* 하단 탭 바: 휴대폰·태블릿. 쓸 수 없는 메뉴는 터치에서 이유를 볼 수 없으므로 숨긴다 */}
      <nav aria-label="주 메뉴" className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-sidebar pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="flex h-16">
          {items.filter((item) => item.why === null).map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0 flex-1">
                <Link
                  href={item.href}
                  aria-current={item.active ? "page" : undefined}
                  className={cn("relative flex h-full flex-col items-center justify-center gap-1 text-xs font-medium tracking-tight", item.active ? "text-primary-700" : "text-ink-muted")}
                >
                  <Pending />
                  <span className={cn("flex h-7 w-12 items-center justify-center rounded-full transition-colors", item.active && "bg-primary-100")}>
                    <Icon className="size-5" />
                  </span>
                  <span className="max-w-full truncate px-0.5">{item.short}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
