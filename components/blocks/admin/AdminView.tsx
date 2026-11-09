"use client";
import { useState } from "react";
import { cn } from "@/components/ui";
import { MembersPanel } from "@/components/blocks/admin/MembersPanel";
import { DeptSettingsPanel } from "@/components/blocks/admin/DeptSettingsPanel";
import type { ManageableWorkspace, Member } from "@/lib/types/domain";

// 관리자 (D-5, FE-013 §3.6). 탭은 권한이 있는 것만 보인다: 멤버 = 이 ws 의 admin, 부서 설정 = can_configure(회사 관리자 포함)
// 규정 문서·접속 기록은 백엔드 API 가 생기면 탭으로 더한다 — 빈 탭을 미리 두지 않는다 (지침 8)
type Tab = "members" | "settings";
export function AdminView({ wsId, wsName, members, manageable }: { wsId: number; wsName: string; members: Member[] | null; manageable: ManageableWorkspace[] }) {
  const tabs: { id: Tab; label: string }[] = [
    ...(members ? [{ id: "members" as const, label: "멤버" }] : []),
    ...(manageable.length ? [{ id: "settings" as const, label: "부서 설정" }] : []),
  ];
  const [tab, setTab] = useState<Tab>(tabs[0]?.id ?? "members");
  return (
    <main className="flex flex-1 flex-col gap-4 p-3 sm:gap-6 md:p-6 xl:p-8">
      <div role="tablist" className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button key={t.id} role="tab" type="button" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
            className={cn("-mb-px border-b-2 px-4 py-2 text-sm font-medium", tab === t.id ? "border-primary-700 text-primary-700" : "border-transparent text-ink-muted hover:text-ink")}>{t.label}</button>
        ))}
      </div>
      {tab === "members" && members && <MembersPanel wsId={wsId} wsName={wsName} initial={members} />}
      {tab === "settings" && manageable.length > 0 && <DeptSettingsPanel initial={manageable} />}
      <p className="text-xs text-ink-muted">규정 문서 관리·접속 기록은 백엔드 API가 생기면 이 화면에 추가됩니다.</p>
    </main>
  );
}
