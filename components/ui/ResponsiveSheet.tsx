"use client";
import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/components/ui";

// 폰·태블릿(~1023px)에서 오른쪽 칸 대신 쓰는 창 (UX-005 §4). 아래에서 올라오고 뒤 화면은 반투명으로 가린다.
// 닫기: 닫기 버튼(44px) · 어두운 곳 누르기 · Esc. 열려 있는 동안 뒤 화면은 스크롤되지 않는다(Dialog 기본 동작).
// PC 에서는 보통 열지 않는다(오른쪽 칸이 같은 본문을 보여 준다). 열리면 가운데 큰 창으로 뜬다.
// 처음 쓴 곳: 어시스턴트 근거 창(EvidenceSheet, 홍경표 046a708) — 그 겉을 공통으로 떼어 냄(#112)
export function ResponsiveSheet({ open, onClose, title, description, children, height = "h-[85dvh]", bodyClassName }: {
  open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; height?: string; bodyClassName?: string;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-ink/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className={cn("fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-2xl bg-card shadow-xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 max-lg:data-[ending-style]:translate-y-full max-lg:data-[starting-style]:translate-y-full lg:bottom-auto lg:top-[7.5dvh] lg:mx-auto lg:w-full lg:max-w-4xl lg:rounded-2xl", height)}>
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-primary-200 lg:hidden" />
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-2">
            <div className="min-w-0">
              <Dialog.Title className="truncate text-base font-bold text-ink">{title}</Dialog.Title>
              {description && <Dialog.Description className="truncate text-xs text-ink-muted">{description}</Dialog.Description>}
            </div>
            <Dialog.Close aria-label="닫기" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-ink hover:bg-primary-100"><X className="size-5" /></Dialog.Close>
          </div>
          <div className={cn("mt-3 flex min-h-0 flex-1 flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]", bodyClassName)}>{children}</div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// 오른쪽 칸이 없는 폭인가(1024px 미만). 버튼을 눌렀을 때 창을 열지(폰) 오른쪽 칸만 바꿀지(PC) 정한다 — 어시스턴트와 같은 기준
export const isNarrow = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
