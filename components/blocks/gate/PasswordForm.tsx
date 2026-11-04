"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui";
import { GateFrame } from "./GateFrame";
import { changePassword, passwordPolicy, type PasswordPolicy } from "@/lib/api/auth";

// 비밀번호 변경 게이트 (작업지시 B-2): 첫 로그인·초기화·180일 만료. 400 PASSWORD_POLICY 는 " / " 로 이어진 위반 목록 → 줄바꿈
export function PasswordForm() {
  const [policy, setPolicy] = useState<PasswordPolicy | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  useEffect(() => { passwordPolicy().then(setPolicy); }, []);
  const mismatch = confirm.length > 0 && next !== confirm;
  return (
    <GateFrame gate="password">
      {(m, done) => (
        <>
          <div>
            <h1 className="text-xl font-bold text-ink">비밀번호 변경</h1>
            <p className="mt-1 text-sm text-ink-muted">{m.password_expires_at && new Date(m.password_expires_at) < new Date() ? "비밀번호 사용 기간이 지났습니다. 새 비밀번호로 바꾼 뒤 계속할 수 있습니다." : "처음 발급받은 비밀번호는 바꾼 뒤에 쓸 수 있습니다."}</p>
          </div>
          {policy && (
            <div className="rounded-lg border border-border bg-primary-50 p-3 text-xs text-ink-muted">
              <p className="font-semibold text-ink">작성 규칙</p>
              <p className="mt-1 whitespace-pre-line">{policy.rule}</p>
              <p className="mt-1">{policy.max_age_days}일마다 변경 · 연속 {policy.lock_after_failures}회 실패 시 {policy.lock_minutes}분 잠금</p>
            </div>
          )}
          <form className="flex flex-col gap-4" onSubmit={async (e) => {
            e.preventDefault();
            if (mismatch || busy) return;
            setBusy(true); setErrors([]);
            const r = await changePassword(current, next);
            if (r.ok) { await done(); return; }
            setErrors(r.code === "PASSWORD_POLICY" ? r.message.split(" / ") : [r.message]);
            setBusy(false);
          }}>
            <Field label="현재 비밀번호" htmlFor="pw-current"><Input id="pw-current" type="password" autoComplete="current-password" className="h-11" value={current} onChange={(e) => setCurrent(e.target.value)} required autoFocus /></Field>
            <Field label="새 비밀번호" htmlFor="pw-next"><Input id="pw-next" type="password" autoComplete="new-password" className="h-11" value={next} onChange={(e) => setNext(e.target.value)} required /></Field>
            <Field label="새 비밀번호 확인" htmlFor="pw-confirm" hint={mismatch ? "새 비밀번호와 다릅니다" : undefined}><Input id="pw-confirm" type="password" autoComplete="new-password" className="h-11" value={confirm} onChange={(e) => setConfirm(e.target.value)} required aria-invalid={mismatch || undefined} /></Field>
            {errors.length > 0 && (
              <ul role="alert" className="list-disc rounded-md bg-fail-bg px-3 py-2 pl-7 text-sm text-fail">{errors.map((x) => <li key={x}>{x}</li>)}</ul>
            )}
            <Button type="submit" size="lg" className="h-11 w-full bg-primary-700 text-white hover:bg-[#27507a]" disabled={busy || mismatch || !current || !next || !confirm}>
              {busy && <Loader2 className="size-4 animate-spin" />} 변경하고 계속
            </Button>
          </form>
        </>
      )}
    </GateFrame>
  );
}
