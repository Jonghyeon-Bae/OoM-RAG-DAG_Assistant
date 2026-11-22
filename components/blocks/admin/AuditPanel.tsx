"use client";
import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip } from "@/components/ui";
import { fetchAudit } from "@/lib/api/client";
import type { AuditItem } from "@/lib/types/domain";

// 접속 기록 (#121) — GET /audit, 회사 관리자만. 로그인·잠금·비밀번호·내 정보 정정·멤버 관리·부서 설정 변경을 최신순으로.
// 읽기 전용이다. IP 는 서버가 가려서 준다. 조건은 서버로 보낸다(사번·종류·기간) — 받은 뒤 화면에서 거르지 않는다.
const actionLabel: Record<string, string> = {
  login_success: "로그인", login_failed: "로그인 실패", login_rejected_locked: "잠긴 계정 로그인 시도", account_locked: "계정 잠김",
  unlocked_by_admin: "잠금 해제(관리자)", logout: "로그아웃", password_changed: "비밀번호 변경", consent: "개인정보 동의", profile_changed: "내 정보 정정",
  invite: "멤버 초대", role_changed: "역할 변경", member_removed: "부서에서 제외", settings_changed: "부서 설정 변경",
  password_reset_by_admin: "임시 비밀번호 재발급", user_deactivated: "계정 비활성화", user_reactivated: "계정 재활성화",
};
const categoryLabel: Record<AuditItem["category"], string> = { auth: "접속", member: "멤버", settings: "설정" };
const warnActions = new Set(["login_failed", "login_rejected_locked", "account_locked", "user_deactivated"]);
const fmt = (iso: string) => new Date(iso).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
const nextDay = (d: string) => { const x = new Date(`${d}T00:00:00`); x.setDate(x.getDate() + 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
const LIMIT = 200;

export function AuditPanel() {
  const [f, setF] = useState({ employee_no: "", action: "", from: "", to: "" });
  const [items, setItems] = useState<AuditItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // "까지" 날짜는 그날을 포함해야 하므로 서버에는 다음 날 0시를 보낸다(서버 to 는 그 시각 전까지)
  const query = (v: typeof f) => fetchAudit({ employee_no: v.employee_no.trim(), action: v.action, from: v.from, to: v.to ? nextDay(v.to) : "", limit: LIMIT });
  const apply = (r: Awaited<ReturnType<typeof fetchAudit>>) => { if (r.ok) { setItems(r.items); setError(null); } else setError(r.message); };
  const search = async (e?: React.FormEvent) => { e?.preventDefault(); setBusy(true); apply(await query(f)); setBusy(false); };
  useEffect(() => {
    let alive = true;
    fetchAudit({ limit: LIMIT }).then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, []);

  const who = (i: AuditItem) => (i.actor && i.actor !== i.employee_no ? i.actor : null);
  const tone = (i: AuditItem) => (warnActions.has(i.action) ? "fail" : i.category === "auth" ? "neutral" : "primary");

  return (
    <Card className="min-w-0 gap-4 p-4 sm:p-6">
      <div>
        <h2 className="font-bold text-ink">접속 기록 {items && <span className="text-sm font-normal text-ink-muted">{items.length}건{items.length >= LIMIT && ` (최근 ${LIMIT}건까지 — 조건을 좁혀 주세요)`}</span>}</h2>
        <p className="mt-1 text-xs text-ink-muted">회사 전체의 로그인·비밀번호·멤버 관리·부서 설정 변경 기록입니다. 회사 관리자만 볼 수 있고, IP 는 일부를 가려 보여 줍니다.</p>
      </div>
      <form onSubmit={search} className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">사번<Input className="h-9 sm:w-32 pointer-coarse:h-11" value={f.employee_no} placeholder="OOM0001" onChange={(e) => setF({ ...f, employee_no: e.target.value })} /></label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">종류
          <select className="h-9 rounded-lg border border-border bg-white px-2 text-sm text-ink pointer-coarse:h-11" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })}>
            <option value="">전체</option>
            {Object.entries(actionLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">부터<Input type="date" className="h-9 pointer-coarse:h-11" value={f.from} max={f.to || undefined} onChange={(e) => setF({ ...f, from: e.target.value })} /></label>
        <label className="flex flex-col gap-1 text-xs text-ink-muted">까지<Input type="date" className="h-9 pointer-coarse:h-11" value={f.to} min={f.from || undefined} onChange={(e) => setF({ ...f, to: e.target.value })} /></label>
        <Button type="submit" size="sm" disabled={busy} className="col-span-2 h-9 bg-primary-700 text-white hover:bg-primary-800 pointer-coarse:h-11">{busy ? <Loader2 className="size-3.5 animate-spin" /> : <Search className="size-3.5" />} 조회</Button>
      </form>
      {error && <p role="alert" className="rounded-md bg-fail-bg px-3 py-2 text-sm text-fail">{error}</p>}
      {!items && !error && <p className="text-sm text-ink-muted">불러오는 중…</p>}
      {items && items.length === 0 && <p className="text-sm text-ink-muted">조건에 맞는 기록이 없습니다.</p>}
      {items && items.length > 0 && (
        <>
          {/* 휴대폰: 2줄 목록 */}
          <ul className="divide-y divide-border sm:hidden">
            {items.map((i) => (
              <li key={i.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink"><Chip tone={tone(i)} className="h-5 text-xs">{actionLabel[i.action] ?? i.action}</Chip><span className="tabular-nums">{i.employee_no ?? "—"}</span></div>
                <div className="mt-0.5 text-xs text-ink-muted"><span className="tabular-nums">{fmt(i.at)}</span>{who(i) && ` · ${who(i)}`}{i.ip_masked && ` · ${i.ip_masked}`}{i.reason && ` · ${i.reason}`}</div>
              </li>
            ))}
          </ul>
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[40rem] text-sm">
              <thead><tr className="border-b border-border text-left text-xs text-ink-muted"><th className="py-2 font-medium">일시</th><th className="font-medium">구분</th><th className="font-medium">동작</th><th className="font-medium">대상 사번</th><th className="font-medium">한 사람</th><th className="font-medium">IP</th><th className="font-medium">내용</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap py-2 tabular-nums text-ink-muted">{fmt(i.at)}</td>
                    <td className="text-ink-muted">{categoryLabel[i.category] ?? i.category}</td>
                    <td><Chip tone={tone(i)} className="h-5 text-xs">{actionLabel[i.action] ?? i.action}</Chip></td>
                    <td className="tabular-nums text-ink">{i.employee_no ?? "—"}</td>
                    <td className="text-ink-muted">{who(i) ?? "—"}</td>
                    <td className="tabular-nums text-ink-muted">{i.ip_masked ?? "—"}</td>
                    <td className="text-ink-muted">{i.reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
