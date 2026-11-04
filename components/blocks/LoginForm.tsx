"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui";
import { login, me, nextPathFor } from "@/lib/api/auth";

// 사번·비밀번호 로그인 (작업지시 B-1). 성공 → 동의/비밀번호 게이트 → 홈 워크스페이스
export function LoginForm() {
  const router = useRouter();
  const [employeeNo, setEmployeeNo] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 이미 로그인된 사용자가 "/" 로 오면 바로 들어간다
  useEffect(() => {
    let alive = true;
    me().then((m) => { if (alive && m) router.replace(nextPathFor(m)); });
    return () => { alive = false; };
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await login(employeeNo, password);
    if (r.ok) {
      router.replace(nextPathFor(r.me));
      return; // 이동 중에는 버튼을 풀지 않는다
    }
    setError(r.message);
    setPassword("");
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-describedby={error ? "login-error" : undefined}>
      <Field label="사번" htmlFor="login-employee-no">
        <Input id="login-employee-no" name="employee_no" autoComplete="username" placeholder="OOM0001" className="h-11" value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} required autoFocus />
      </Field>
      <Field label="비밀번호" htmlFor="login-password">
        <Input id="login-password" name="password" type="password" autoComplete="current-password" className="h-11" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && <p id="login-error" role="alert" className="rounded-md bg-fail-bg px-3 py-2 text-sm text-fail">{error}</p>}
      <Button type="submit" size="lg" className="h-11 w-full bg-primary-700 text-white hover:bg-[#27507a]" disabled={busy || !employeeNo.trim() || !password}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />} 로그인
      </Button>
    </form>
  );
}
