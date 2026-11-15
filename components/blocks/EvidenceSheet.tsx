"use client";
import type { ReactNode } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/components/ui";

export type EvidenceTab = "flow" | "policy";
// flow · policy 중 없는 쪽은 null 로 넘긴다 → 탭 없이 있는 것만 보여 준다
interface EvidenceProps {
  tab: EvidenceTab; onTab: (tab: EvidenceTab) => void;
  flow: ReactNode | null; policy: ReactNode | null;
  flowCount: number; policyCount: number;
}

// 근거 내용: 탭(해결 흐름 / 규정 원문) + 본문. PC 의 오른쪽 칸과 폰의 근거 창이 같이 쓴다.
export function EvidenceBody({ tab, onTab, flow, policy, flowCount, policyCount, empty }: EvidenceProps & { empty?: ReactNode }) {
  if (!flow && !policy) return <>{empty ?? null}</>;
  const both = !!flow && !!policy;
  const shown: EvidenceTab = both ? tab : flow ? "flow" : "policy";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {both && (
        <div role="tablist" className="grid shrink-0 grid-cols-2 gap-1 rounded-xl bg-primary-50 p-1">
          {(["flow", "policy"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={shown === t} onClick={() => onTab(t)} className={cn("h-11 rounded-lg text-sm", shown === t ? "bg-primary-700 font-bold text-white" : "font-medium text-ink-muted hover:bg-primary-100")}>
              {t === "flow" ? `해결 흐름 ${flowCount}` : `규정 원문 ${policyCount}`}
            </button>
          ))}
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{shown === "flow" ? flow : policy}</div>
    </div>
  );
}

// 폰·태블릿(~1023px) 근거 창: PC 의 오른쪽 칸을 대신한다. 답변 아래 버튼이나 번호를 누르면 화면 아래에서 올라오고, 뒤 화면은 반투명으로 가린다.
// 닫기: 닫기 버튼 · 어두운 곳 누르기 · Esc. 열려 있는 동안 뒤 화면은 스크롤되지 않는다(Dialog 기본 동작).
export function EvidenceSheet({ open, onClose, query, ...body }: EvidenceProps & { open: boolean; onClose: () => void; query: string }) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-ink/50 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col rounded-t-2xl bg-card shadow-xl outline-none transition-[transform,opacity] duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 max-lg:data-[ending-style]:translate-y-full max-lg:data-[starting-style]:translate-y-full lg:bottom-auto lg:top-[7.5dvh] lg:mx-auto lg:w-full lg:max-w-4xl lg:rounded-2xl">
          <span aria-hidden className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-primary-200 lg:hidden" />
          <div className="flex shrink-0 items-center justify-between gap-2 px-4 pt-2">
            <div className="min-w-0">
              <Dialog.Title className="text-base font-bold text-ink">이 답변의 근거</Dialog.Title>
              <Dialog.Description className="truncate text-xs text-ink-muted">질문: {query}</Dialog.Description>
            </div>
            <Dialog.Close aria-label="닫기" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-50 text-ink hover:bg-primary-100"><X className="size-5" /></Dialog.Close>
          </div>
          <div className="mt-3 flex min-h-0 flex-1 flex-col px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <EvidenceBody {...body} />
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}