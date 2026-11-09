"use client";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GateFrame } from "./GateFrame";
import { consent, privacyPolicy } from "@/lib/api/auth";
import { Markdown } from "@/components/ui/Markdown";

// 개인정보 수집·이용 동의 (작업지시 B-2). 문안은 서버 GET /auth/privacy-policy (data/legal/privacy_policy.md) — 하드코딩하지 않는다 (FE-012 P0-5, R-30)
// 문안을 못 받으면 동의 버튼을 막는다: 읽지 않은 문안에 동의시키지 않는다. 운영에서 이 상태면 서버 data/legal 마운트 누락
export function ConsentForm() {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState<string | null | undefined>(undefined); // undefined = 불러오는 중, null = 실패
  useEffect(() => { privacyPolicy().then(setText); }, []);
  return (
    <GateFrame gate="consent">
      {(_m, done) => (
        <>
          <div>
            <h1 className="text-xl font-bold text-ink">개인정보 수집·이용 동의</h1>
            <p className="mt-1 text-sm text-ink-muted">처음 로그인할 때 한 번만 묻습니다.</p>
          </div>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border bg-primary-50 p-4 text-sm text-ink-muted">
            {text === undefined ? <p>문안을 불러오는 중…</p> : text === null ? <p className="text-fail">처리방침 문안을 불러오지 못했습니다. 잠시 후 다시 시도하거나 관리자에게 문의해 주세요.</p> : <Markdown text={text} className="flex flex-col gap-3" />}
          </div>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" className="mt-0.5 size-4" disabled={!text} checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            위 내용을 읽었으며 개인정보 수집·이용에 동의합니다.
          </label>
          {error && <p role="alert" className="rounded-md bg-fail-bg px-3 py-2 text-sm text-fail">{error}</p>}
          <Button type="button" size="lg" className="h-11 w-full bg-primary-700 text-white hover:bg-primary-800" disabled={!checked || busy || !text}
            onClick={async () => { setBusy(true); setError(null); const r = await consent(); if (r.ok) await done(); else { setError(r.message); setBusy(false); } }}>
            {busy && <Loader2 className="size-4 animate-spin" />} 동의하고 계속
          </Button>
        </>
      )}
    </GateFrame>
  );
}
