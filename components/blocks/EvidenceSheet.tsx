"use client";
import type { ReactNode } from "react";
import { ResponsiveSheet } from "@/components/ui/ResponsiveSheet";
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

// 폰·태블릿(~1023px) 근거 창: PC 의 오른쪽 칸을 대신한다. 답변 아래 버튼이나 번호를 누르면 화면 아래에서 올라온다.
// 겉(배경·손잡이·제목·닫기)은 공통 ResponsiveSheet — 타임라인·등록·규정 문서와 같은 창(UX-005, #112). 동작은 그대로
export function EvidenceSheet({ open, onClose, query, ...body }: EvidenceProps & { open: boolean; onClose: () => void; query: string }) {
  return (
    <ResponsiveSheet open={open} onClose={onClose} title="이 답변의 근거" description={`질문: ${query}`}>
      <EvidenceBody {...body} />
    </ResponsiveSheet>
  );
}
