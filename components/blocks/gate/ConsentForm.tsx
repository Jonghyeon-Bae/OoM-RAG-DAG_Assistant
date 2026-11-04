"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GateFrame } from "./GateFrame";
import { consent } from "@/lib/api/auth";

// 개인정보 수집·이용 동의 (작업지시 B-2). 문안은 프론트 보유 — 서버는 동의 시각만 기록한다 (AuthController.consent)
const TERMS = [
  ["수집 항목", "사번, 이름, 직함, 사내 이메일, 소속 워크스페이스, 로그인 기록(시각·IP), 질문·피드백 내용"],
  ["이용 목적", "사내 규정·장애 해결 기록 검색 서비스 제공, 접근통제(로그인 잠금·비밀번호 만료), 서비스 품질 측정(답변 평가·대시보드)"],
  ["보유 기간", "재직 기간 동안 보유하며 퇴직 시 계정은 발령일에 잠기고 30일 이내 삭제됩니다. 질문·로그 기록은 작성자 식별 없이 업무 지식으로 남을 수 있습니다"],
  ["제3자 제공", "없습니다. 답변 생성에 외부 언어모델 API 를 쓰는 경우 질문 문장이 전송되며, 개인 식별 정보는 보내지 않습니다"],
  ["동의 거부", "동의하지 않으면 서비스를 이용할 수 없습니다. 동의는 관리자에게 요청하여 철회할 수 있습니다"],
] as const;

export function ConsentForm() {
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <GateFrame gate="consent">
      {(_m, done) => (
        <>
          <div>
            <h1 className="text-xl font-bold text-ink">개인정보 수집·이용 동의</h1>
            <p className="mt-1 text-sm text-ink-muted">처음 로그인할 때 한 번만 묻습니다.</p>
          </div>
          <dl className="max-h-72 overflow-y-auto rounded-lg border border-border bg-primary-50 p-4 text-sm">
            {TERMS.map(([k, v]) => (
              <div key={k} className="mb-3 last:mb-0">
                <dt className="font-semibold text-ink">{k}</dt>
                <dd className="mt-0.5 text-ink-muted">{v}</dd>
              </div>
            ))}
          </dl>
          <label className="flex items-start gap-3 text-sm text-ink">
            <input type="checkbox" className="mt-0.5 size-4" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            위 내용을 읽었으며 개인정보 수집·이용에 동의합니다.
          </label>
          {error && <p role="alert" className="rounded-md bg-fail-bg px-3 py-2 text-sm text-fail">{error}</p>}
          <Button type="button" size="lg" className="h-11 w-full bg-primary-700 text-white hover:bg-[#27507a]" disabled={!checked || busy}
            onClick={async () => { setBusy(true); setError(null); const r = await consent(); if (r.ok) await done(); else { setError(r.message); setBusy(false); } }}>
            {busy && <Loader2 className="size-4 animate-spin" />} 동의하고 계속
          </Button>
        </>
      )}
    </GateFrame>
  );
}
