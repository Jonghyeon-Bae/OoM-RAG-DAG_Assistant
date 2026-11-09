"use client";
import { Fragment, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Chip, Avatar } from "@/components/ui";
import { PasswordChange } from "@/components/blocks/account/PasswordChange";
import { PrivacyText } from "@/components/blocks/account/PrivacyText";
import { modeOf, modeShort, modeTone } from "@/lib/mode";
import type { Me } from "@/lib/types/domain";

// 마이페이지 (D-5, FE-013 §3.6). 백엔드에 있는 것만: GET /me 보기, PATCH /auth/password 변경.
// 이름·직함·이메일 정정은 PATCH /me 가 생기면 편집으로 바꾼다 (FE-013 §3.2 요청서). 주소·휴대전화는 받지 않는다 (D-7)
const roleLabel: Record<string, string> = { admin: "관리자", member: "멤버" };

export function MyPageView({ me, wsId, daysLeft }: { me: Me; wsId: number; daysLeft: number | null }) {
  const [changed, setChanged] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const rows: [string, string][] = [["사번", me.employee_no], ["이름", me.name], ["직함", me.title ?? "—"], ["이메일", me.email ?? "—"]];
  return (
    <main className="grid flex-1 items-start gap-6 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:p-8">
      <div className="flex min-w-0 flex-col gap-6">
        <Card className="gap-4 p-6">
          <div className="flex items-center gap-4">
            <Avatar name={me.name} className="size-12 text-lg" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-ink">{me.name}</h2>
                {me.company_admin && <Chip tone="dark" className="h-5 text-[11px]" title="회사 전체(전사 공통)의 관리자">회사 관리자</Chip>}
              </div>
              <p className="text-sm text-ink-muted">{me.title ?? "직함 없음"}</p>
            </div>
          </div>
          <dl className="grid grid-cols-[88px_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            {rows.map(([k, v]) => (<Fragment key={k}><dt className="text-ink-muted">{k}</dt><dd className="truncate text-ink">{v}</dd></Fragment>))}
          </dl>
          <p className="rounded-md bg-primary-50 px-3 py-2 text-xs text-ink-muted">이름·직함·이메일을 바꿔야 하면 관리자에게 요청해 주세요. 화면에서 직접 고치는 기능은 준비 중입니다.</p>
        </Card>

        <Card className="gap-3 p-6">
          <h2 className="font-bold text-ink">소속 워크스페이스</h2>
          <ul className="flex flex-col divide-y divide-border">
            {me.workspaces.map((w) => (
              <li key={w.id} className="flex items-center gap-3 py-2.5 text-sm">
                <Link href={`/w/${w.id}/assistant`} className="min-w-0 flex-1 truncate text-ink hover:underline">{w.name}</Link>
                {w.id === wsId && <Chip tone="primary" className="h-5 text-[11px]">지금</Chip>}
                <Chip tone={modeTone(modeOf(w))} className="h-5 text-[11px]">{modeShort[modeOf(w)]}</Chip>
                <span className="w-12 text-right text-xs text-ink-muted">{roleLabel[w.role] ?? w.role}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-muted">소속·역할은 관리자가 정합니다.</p>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-6">
        <Card className="gap-4 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-bold text-ink">비밀번호 변경</h2>
            {daysLeft !== null && (
              <Chip tone={daysLeft <= 14 ? "warn" : "neutral"} className="h-6 text-xs" title={me.password_expires_at ? `만료 ${new Date(me.password_expires_at).toLocaleDateString("ko-KR")}` : undefined}>
                {daysLeft <= 0 ? "사용 기간 지남" : `만료까지 ${daysLeft}일`}
              </Chip>
            )}
          </div>
          {changed && <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-sm text-success">비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.</p>}
          <PasswordChange submitLabel="비밀번호 변경" onDone={() => setChanged(true)} />
        </Card>

        <Card className="gap-3 p-6">
          <button type="button" onClick={() => setPrivacyOpen((o) => !o)} aria-expanded={privacyOpen} className="flex items-center justify-between text-left">
            <h2 className="font-bold text-ink">개인정보 처리방침</h2>
            <span className="text-xs text-ink-muted">{privacyOpen ? "접기" : "펼치기"}</span>
          </button>
          {privacyOpen && <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-primary-50 p-4"><PrivacyText /></div>}
        </Card>
      </div>
    </main>
  );
}
