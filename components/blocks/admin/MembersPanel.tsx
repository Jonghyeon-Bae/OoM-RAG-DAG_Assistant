"use client";
import { Fragment, useState } from "react";
import { Copy, Loader2, Lock, UserPlus, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, Field } from "@/components/ui";
import { ACCOUNT_API_READY, changeMemberRole, deactivateUser, fetchMembers, inviteUser, removeMember, resetUserPassword, unlockUser } from "@/lib/api/client";
import type { InviteResult, Member, MemberRole } from "@/lib/types/domain";

// 멤버: 목록(이메일 마스킹) · 초대(임시 비밀번호 1회 표시) · 잠금 해제 — 현재 워크스페이스 admin 전용 (D-5)
// 멤버 관리(#104): 역할 변경·부서에서 제외 = 부서 관리자(서버 구현됨), 임시 비밀번호 재발급 = 부서 관리자(REQ-11), 계정 비활성화 = 회사 관리자 — 둘은 FE-REQ-004로 서버 대기
const roleLabel: Record<MemberRole, string> = { admin: "관리자", member: "멤버" };

export function MembersPanel({ wsId, wsName, initial, meId, companyAdmin }: { wsId: number; wsName: string; initial: Member[]; meId: number; companyAdmin: boolean }) {
  const [members, setMembers] = useState(initial);
  const [form, setForm] = useState({ employee_no: "", name: "", email: "", title: "", role: "member" as MemberRole });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [unlocking, setUnlocking] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const reload = async () => setMembers(await fetchMembers(wsId));

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setResult(null); setCopied(false);
    const r = await inviteUser(wsId, {
      employee_no: form.employee_no.trim(), name: form.name.trim(), role: form.role,
      ...(form.email.trim() ? { email: form.email.trim() } : {}), ...(form.title.trim() ? { title: form.title.trim() } : {}),
    });
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setResult(r.data);
    setForm({ employee_no: "", name: "", email: "", title: "", role: "member" });
    await reload();
  };
  const unlock = async (m: Member) => {
    setUnlocking(m.id); setNotice(null);
    const r = await unlockUser(wsId, m.id);
    setUnlocking(null);
    setNotice(r.ok ? `${m.name} 계정의 잠금을 풀었습니다` : r.message);
    if (r.ok) await reload();
  };

  // 한 번에 한 사람만 펼친다. 되돌리기 어려운 동작(제외·비활성화)은 펼친 칸 안에서 한 번 더 확인한다
  const [openId, setOpenId] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<{ id: number; kind: "remove" | "deactivate"; reason: string } | null>(null);
  const [acting, setActing] = useState(false);
  const [reset, setReset] = useState<{ name: string; temp: string } | null>(null);
  const act = async (label: string, run: () => Promise<{ ok: true } | { ok: false; message: string }>, close = true) => {
    setActing(true); setNotice(null);
    const r = await run();
    setActing(false);
    setNotice(r.ok ? label : r.message);
    if (r.ok) { setConfirm(null); if (close) setOpenId(null); await reload(); }
  };
  const setRole = (m: Member, role: MemberRole) => act(`${m.name}: ${roleLabel[role]}(으)로 바꿨습니다`, async () => { const r = await changeMemberRole(wsId, m.id, role); return r.ok ? { ok: true } : r; }, false);
  const remove = (m: Member) => act(`${m.name}을(를) ${wsName}에서 제외했습니다 — 계정과 작성한 기록은 남습니다`, () => removeMember(wsId, m.id));
  const deactivate = (m: Member, reason: string) => act(`${m.name} 계정을 비활성화했습니다 — 로그인할 수 없고, 작성한 기록은 남습니다`, () => deactivateUser(wsId, m.id, reason));
  const resetPw = async (m: Member) => {
    setActing(true); setNotice(null);
    const r = await resetUserPassword(wsId, m.id);
    setActing(false);
    if (r.ok) setReset({ name: m.name, temp: r.temp_password }); else setNotice(r.message);
  };

  const manage = (m: Member) => {
    const self = m.id === meId;
    const c = confirm?.id === m.id ? confirm : null;
    const pending = !ACCOUNT_API_READY;
    return (
      <div className="flex flex-col gap-3 rounded-lg bg-primary-50 p-3 text-sm">
        {self && <p className="text-xs text-ink-muted">본인 계정입니다. 역할 변경·제외·비활성화는 다른 관리자가 합니다.</p>}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">이 부서에서 — 부서 관리자{pending && <span className="font-normal"> · 비밀번호 재발급은 서버 준비 중</span>}</span>
          <div className="flex flex-wrap gap-2">
            {m.role === "member"
              ? <Button size="xs" variant="outline" disabled={self || acting} onClick={() => setRole(m, "admin")}>관리자로 지정</Button>
              : <Button size="xs" variant="outline" disabled={self || acting} onClick={() => setRole(m, "member")}>멤버로 변경</Button>}
            <Button size="xs" variant="outline" disabled={self || acting} onClick={() => setConfirm({ id: m.id, kind: "remove", reason: "" })} className="text-warn hover:bg-warn-bg hover:text-warn">부서에서 제외</Button>
            <Button size="xs" variant="outline" disabled={pending || self || acting} onClick={() => resetPw(m)} title={pending ? "백엔드 API 준비 중(FE-REQ-004)" : "새 임시 비밀번호를 한 번 보여 줍니다. 다음 로그인 때 바꾸게 됩니다"}>임시 비밀번호 재발급</Button>
          </div>
        </div>
        {companyAdmin && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-ink-muted">계정 전체 — 회사 관리자{pending && <span className="font-normal"> · 서버 준비 중(FE-REQ-004)</span>}</span>
            <div className="flex flex-wrap gap-2">
              <Button size="xs" variant="outline" disabled={pending || self || acting} onClick={() => setConfirm({ id: m.id, kind: "deactivate", reason: "" })} title={pending ? "백엔드 API 준비 중(FE-REQ-004)" : "모든 부서에서 로그인할 수 없게 합니다. 작성한 기록은 남습니다"} className="text-fail hover:bg-fail-bg hover:text-fail">계정 비활성화</Button>
            </div>
          </div>
        )}
        {c?.kind === "remove" && (
          <div className="flex flex-col gap-2 rounded-md border border-warn-bg bg-card p-2.5 text-xs text-ink">
            <span><b>{m.name}</b>을(를) <b>{wsName}</b>에서 제외합니다. 계정과 작성한 기록은 남고, 다른 부서 소속은 그대로입니다.</span>
            <div className="flex gap-2"><Button size="xs" disabled={acting} onClick={() => remove(m)} className="bg-warn text-white hover:bg-warn/90">제외</Button><Button size="xs" variant="ghost" onClick={() => setConfirm(null)}>취소</Button></div>
          </div>
        )}
        {c?.kind === "deactivate" && (
          <div className="flex flex-col gap-2 rounded-md border border-fail-bg bg-card p-2.5 text-xs text-ink">
            <span><b>{m.name}</b> 계정을 비활성화합니다. 모든 부서에서 로그인할 수 없게 되고, 작성한 기록·감사 기록은 남습니다. 회사 관리자가 다시 활성화할 수 있습니다.</span>
            <input value={c.reason} onChange={(e) => setConfirm({ ...c, reason: e.target.value })} placeholder="사유 (예: 퇴사 · 장기 미사용)" className="h-9 rounded-md border border-border bg-white px-2 text-xs pointer-coarse:h-11" />
            <div className="flex gap-2"><Button size="xs" disabled={acting || !c.reason.trim()} onClick={() => deactivate(m, c.reason.trim())} className="bg-fail text-white hover:bg-fail/90">비활성화</Button><Button size="xs" variant="ghost" onClick={() => setConfirm(null)}>취소</Button></div>
          </div>
        )}
      </div>
    );
  };
  const toggle = (m: Member) => { setConfirm(null); setOpenId((o) => (o === m.id ? null : m.id)); };
  const manageBtn = (m: Member) => (
    <Button size="xs" variant="ghost" aria-expanded={openId === m.id} onClick={() => toggle(m)} title="역할·제외·계정 관리"><Settings2 className="size-3" /> 관리</Button>
  );

  const status = (m: Member) =>
    m.locked ? (
      <Button variant="outline" size="xs" onClick={() => unlock(m)} disabled={unlocking === m.id} title="로그인 연속 실패로 잠긴 계정. 풀면 바로 로그인할 수 있습니다">
        {unlocking === m.id ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />} 잠금 해제
      </Button>
    ) : <span className="text-xs text-ink-muted">정상</span>;

  return (
    <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="min-w-0 gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-ink">{wsName} 멤버 <span className="text-sm font-normal text-ink-muted">{members.length}명</span></h2>
          {notice && <span role="status" className="text-xs text-ink-muted">{notice}</span>}
        </div>
        {reset && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 p-3 text-sm">
            <span><b>{reset.name}</b> 임시 비밀번호(한 번만 표시):</span>
            <code className="rounded bg-white px-2 py-0.5 font-mono">{reset.temp}</code>
            <Button size="xs" variant="outline" onClick={() => navigator.clipboard?.writeText(reset.temp)}><Copy className="size-3" /> 복사</Button>
            <Button size="xs" variant="ghost" onClick={() => setReset(null)}>닫기</Button>
          </div>
        )}
        {/* 휴대폰: 표 대신 2줄 목록(가로 스크롤 없이) */}
        <ul className="divide-y divide-border sm:hidden">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-sm text-ink">{m.name}<span className="text-xs text-ink-muted">{m.title ?? ""}</span><Chip tone={m.role === "admin" ? "primary" : "neutral"} className="h-5 text-xs">{roleLabel[m.role]}</Chip></div>
                <div className="mt-0.5 truncate text-xs text-ink-muted"><span className="tabular-nums">{m.employee_no}</span> · {m.email_masked ?? "이메일 없음"}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1">{status(m)}{manageBtn(m)}</div>
              {openId === m.id && <div className="basis-full">{manage(m)}</div>}
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto sm:block">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-ink-muted"><th className="py-2 font-medium">이름</th><th className="font-medium">사번</th><th className="font-medium">직함</th><th className="font-medium">이메일</th><th className="font-medium">역할</th><th className="text-right font-medium">상태</th><th className="w-16" /></tr></thead>
            <tbody>
              {members.map((m) => (
                <Fragment key={m.id}>
                <tr className={openId === m.id ? "" : "border-b border-border last:border-0"}>
                  <td className="py-2.5 text-ink">{m.name}</td>
                  <td className="tabular-nums text-ink-muted">{m.employee_no}</td>
                  <td className="text-ink-muted">{m.title ?? "—"}</td>
                  <td className="text-ink-muted">{m.email_masked ?? "—"}</td>
                  <td><Chip tone={m.role === "admin" ? "primary" : "neutral"} className="h-5 text-xs">{roleLabel[m.role]}</Chip></td>
                  <td className="text-right">
                    {status(m)}
                  </td>
                  <td className="text-right">{manageBtn(m)}</td>
                </tr>
                {openId === m.id && <tr className="border-b border-border"><td colSpan={7} className="pb-3">{manage(m)}</td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-muted">역할 변경·멤버 제외는 준비 중입니다(백엔드 API 요청 — FE-013 §3.2).</p>
      </Card>

      <Card className="gap-4 p-6">
        <h2 className="flex items-center gap-2 font-bold text-ink"><UserPlus className="size-4" /> 멤버 초대</h2>
        <p className="text-xs text-ink-muted">새 사번이면 계정을 만들고 임시 비밀번호를 한 번 보여줍니다. 이미 있는 사번이면 이 워크스페이스 멤버로만 추가합니다. 받은 사람은 첫 로그인 때 개인정보 동의와 비밀번호 변경을 거칩니다.</p>
        <form onSubmit={invite} className="flex flex-col gap-3">
          <Field label="사번" htmlFor="inv-no"><Input id="inv-no" className="h-10" placeholder="OOM0006" value={form.employee_no} onChange={(e) => setForm({ ...form, employee_no: e.target.value })} required pattern="[A-Za-z0-9-]{3,32}" /></Field>
          <Field label="이름" htmlFor="inv-name"><Input id="inv-name" className="h-10" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
          <Field label="직함 (선택)" htmlFor="inv-title"><Input id="inv-title" className="h-10" placeholder="예: 매니저" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
          <Field label="이메일 (선택)" htmlFor="inv-email"><Input id="inv-email" type="email" className="h-10" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <fieldset className="flex items-center gap-4 text-sm">
            <legend className="mb-1 text-sm font-medium text-ink">역할</legend>
            {(["member", "admin"] as MemberRole[]).map((r) => (
              <label key={r} className="flex items-center gap-1.5"><input type="radio" name="inv-role" checked={form.role === r} onChange={() => setForm({ ...form, role: r })} /> {roleLabel[r]}</label>
            ))}
          </fieldset>
          {error && <p role="alert" className="rounded-md bg-fail-bg px-3 py-2 text-sm text-fail">{error}</p>}
          <Button type="submit" size="lg" className="h-10 bg-primary-700 text-white hover:bg-primary-800" disabled={busy || !form.employee_no.trim() || !form.name.trim()}>
            {busy && <Loader2 className="size-4 animate-spin" />} 초대
          </Button>
        </form>
        {result && (
          <div role="status" className="rounded-lg border border-success-bg bg-success-bg/50 p-4 text-sm">
            <p className="font-semibold text-ink">{result.name}({result.employee_no}) {result.created ? "계정을 만들었습니다" : "을 이 워크스페이스에 추가했습니다"}</p>
            {result.temp_password ? (
              <>
                <div className="mt-2 flex items-center gap-2">
                  <code className="flex-1 rounded bg-white px-2 py-1.5 font-mono text-sm tracking-wide text-ink">{result.temp_password}</code>
                  <Button type="button" variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(result.temp_password!); setCopied(true); } catch { setCopied(false); } }}><Copy className="size-3.5" /> {copied ? "복사됨" : "복사"}</Button>
                </div>
                <p className="mt-2 text-xs text-warn">임시 비밀번호는 지금 한 번만 보입니다. 본인에게 직접 전달하고 메신저·메일 기록에 남기지 마세요.</p>
              </>
            ) : <p className="mt-1 text-xs text-ink-muted">기존 계정이라 비밀번호는 바뀌지 않았습니다.</p>}
            <button type="button" onClick={() => setResult(null)} className="mt-2 text-xs text-ink-muted underline">닫기</button>
          </div>
        )}
      </Card>
    </div>
  );
}
