"use client";
import { useState } from "react";
import { Copy, Loader2, Lock, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Chip, Field } from "@/components/ui";
import { fetchMembers, inviteUser, unlockUser } from "@/lib/api/client";
import type { InviteResult, Member, MemberRole } from "@/lib/types/domain";

// 멤버: 목록(이메일 마스킹) · 초대(임시 비밀번호 1회 표시) · 잠금 해제 — 현재 워크스페이스 admin 전용 (D-5)
const roleLabel: Record<MemberRole, string> = { admin: "관리자", member: "멤버" };

export function MembersPanel({ wsId, wsName, initial }: { wsId: number; wsName: string; initial: Member[] }) {
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

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="min-w-0 gap-3 p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold text-ink">{wsName} 멤버 <span className="text-sm font-normal text-ink-muted">{members.length}명</span></h2>
          {notice && <span role="status" className="text-xs text-ink-muted">{notice}</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-border text-left text-xs text-ink-muted"><th className="py-2 font-medium">이름</th><th className="font-medium">사번</th><th className="font-medium">직함</th><th className="font-medium">이메일</th><th className="font-medium">역할</th><th className="text-right font-medium">상태</th></tr></thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b border-border last:border-0">
                  <td className="py-2.5 text-ink">{m.name}</td>
                  <td className="tabular-nums text-ink-muted">{m.employee_no}</td>
                  <td className="text-ink-muted">{m.title ?? "—"}</td>
                  <td className="text-ink-muted">{m.email_masked ?? "—"}</td>
                  <td><Chip tone={m.role === "admin" ? "primary" : "neutral"} className="h-5 text-[11px]">{roleLabel[m.role]}</Chip></td>
                  <td className="text-right">
                    {m.locked ? (
                      <Button variant="outline" size="xs" onClick={() => unlock(m)} disabled={unlocking === m.id} title="로그인 연속 실패로 잠긴 계정. 풀면 바로 로그인할 수 있습니다">
                        {unlocking === m.id ? <Loader2 className="size-3 animate-spin" /> : <Lock className="size-3" />} 잠금 해제
                      </Button>
                    ) : <span className="text-xs text-ink-muted">정상</span>}
                  </td>
                </tr>
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
