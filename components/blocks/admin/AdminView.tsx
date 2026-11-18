"use client";
import { useState } from "react";
import { cn } from "@/components/ui";
import { MembersPanel } from "@/components/blocks/admin/MembersPanel";
import { DeptSettingsPanel } from "@/components/blocks/admin/DeptSettingsPanel";
import { AuditPanel } from "@/components/blocks/admin/AuditPanel";
import type { ManageableWorkspace, Member } from "@/lib/types/domain";

// 관리자 (D-5, FE-013 §3.6). 탭은 권한이 있는 것만 보인다: 멤버 = 이 ws 의 admin, 부서 설정 = can_configure(회사 관리자 포함)
// 접속 기록 = 회사 관리자(GET /audit, #121). 규정 문서 관리는 문서 메뉴(/documents)에서 한다
type Tab = "members" | "settings" | "audit";
export function AdminView({ wsId, wsName, members, manageable, meId, companyAdmin }: { wsId: number; wsName: string; members: Member[] | null; manageable: ManageableWorkspace[]; meId: number; companyAdmin: boolean }) {
  const tabs: { id: Tab; label: string }[] = [
    ...(members ? [{ id: "members" as const, label: "멤버" }] : []),
    ...(manageable.length ? [{ id: "settings" as const, label: "부서 설정" }] : []),
    ...(companyAdmin ? [{ id: "audit" as const, label: "접속 기록" }] : []),
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
      {tab === "members" && members && <MembersPanel wsId={wsId} wsName={wsName} initial={members} meId={meId} companyAdmin={companyAdmin} />}
      {tab === "settings" && manageable.length > 0 && <DeptSettingsPanel initial={manageable} />}
      {tab === "audit" && companyAdmin && <AuditPanel />}
    </main>
  );
}
