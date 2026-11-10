"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui";
import { patchWorkspaceSettings } from "@/lib/api/client";
import { modeOf, modeLabel, modeTone } from "@/lib/mode";
import type { ManageableWorkspace } from "@/lib/types/domain";

// 부서 설정 (백엔드 요청 G, D-5): 규정 사용 · 사례 사용 스위치. can_configure 인 부서만 내려온다(회사 관리자는 회사 전 부서).
// 둘 다 끌 수 없다 — 화면에서 막고 서버도 400 NO_SOURCE. 바꾸면 사이드바·헤더가 새 모드를 보도록 router.refresh()
export function DeptSettingsPanel({ initial }: { initial: ManageableWorkspace[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: number; text: string; ok: boolean } | null>(null);
  const toggle = async (w: ManageableWorkspace, key: "policy_enabled" | "case_enabled") => {
    const next = !w[key];
    setBusy(`${w.id}-${key}`); setMsg(null);
    const r = await patchWorkspaceSettings(w.id, { [key]: next });
    setBusy(null);
    if (!r.ok) { setMsg({ id: w.id, text: r.message, ok: false }); return; }
    setRows((rs) => rs.map((x) => (x.id === w.id ? { ...x, policy_enabled: r.data.policy_enabled, case_enabled: r.data.case_enabled } : x)));
    setMsg({ id: w.id, text: `바꿨습니다 — 지금 설정: ${modeLabel[modeOf(r.data)]}`, ok: true });
    router.refresh();
  };
  // 렌더 함수(컴포넌트 아님) — 렌더마다 새 컴포넌트가 되어 포커스가 튀는 것을 막는다 (#058 과 같은 이유)
  const sw = (w: ManageableWorkspace, k: "policy_enabled" | "case_enabled", label: string, hint: string) => {
    const on = w[k];
    const last = on && !(k === "policy_enabled" ? w.case_enabled : w.policy_enabled); // 이걸 끄면 둘 다 꺼짐
    return (
      <label key={k} className="flex items-center gap-2 text-sm" title={last ? "규정과 해결 사례를 모두 끌 수는 없습니다" : hint}>
        <button type="button" role="switch" aria-checked={on} aria-label={`${w.name} ${label}`} disabled={last || busy !== null} onClick={() => toggle(w, k)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${on ? "bg-primary-700" : "bg-ref-bg"}`}>
          <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
        </button>
        <span className="text-ink">{label}</span>
      </label>
    );
  };
  return (
    <Card className="gap-3 p-4 sm:p-6">
      <div>
        <h2 className="font-bold text-ink">부서 설정</h2>
        <p className="mt-1 text-xs text-ink-muted">부서마다 AI 어시스턴트가 무엇을 근거로 답할지 정합니다. 해결 사례를 끄면 그 부서의 타임라인·업무로그 등록 메뉴가 닫힙니다(기록은 지워지지 않습니다). 변경은 감사 로그에 남습니다.</p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {rows.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
            <div className="min-w-40 flex-1">
              <div className="flex items-center gap-2"><span className="font-medium text-ink">{w.name}</span><Chip tone={modeTone(modeOf(w))} className="h-5 text-xs">{modeLabel[modeOf(w)]}</Chip></div>
              <div className="mt-0.5 text-xs text-ink-muted">검색되는 규정 {w.policy_docs}종(전사 공통 포함) · 해결 사례 {w.cases}건</div>
            </div>
            {sw(w, "policy_enabled", "규정 사용", "사내 규정 조문을 근거로 답합니다")}
            {sw(w, "case_enabled", "해결 사례 사용", "이 부서의 장애 해결 기록을 근거로 답합니다")}
            {msg?.id === w.id && <span role="status" className={`w-full text-xs ${msg.ok ? "text-success" : "text-fail"}`}>{msg.text}</span>}
          </li>
        ))}
      </ul>
    </Card>
  );
}
