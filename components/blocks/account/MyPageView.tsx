"use client";
import { useState } from "react";
import Link from "next/link";
import { Building2, ChevronDown, FileText, Hash, House, IdCard, Info, KeyRound, Mail, ShieldCheck, Briefcase } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import { PasswordChange } from "@/components/blocks/account/PasswordChange";
import { PrivacyText } from "@/components/blocks/account/PrivacyText";
import { modeOf, modeShort, modeTone } from "@/lib/mode";
import type { Me } from "@/lib/types/domain";

// 마이페이지 (D-5, FE-013 §3.6, #090 디자인 정리). 백엔드에 있는 것만 보여준다: GET /me, PATCH /auth/password.
// - 이름·직함·이메일 정정: PATCH /me 요청 중(FE-REQ-002 REQ-1) → 지금은 읽기 전용
// - "기본" = me.workspace_id(로그인하면 처음 열리는 부서, 서버가 admin 소속 우선으로 계산). 메인 부서 지정은 백엔드에 개념이 없어 요청(REQ-7)
// - 주소·휴대전화는 받지 않는다 (D-7)
const roleLabel: Record<string, string> = { admin: "관리자", member: "멤버" };
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

function Section({ icon, title, desc, children, action }: { icon: React.ReactNode; title: string; desc?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 border-b border-border px-6 py-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-100 text-primary-700">{icon}</span>
          <div>
            <h2 className="font-semibold text-ink">{title}</h2>
            {desc && <p className="mt-0.5 text-xs text-ink-muted">{desc}</p>}
          </div>
        </div>
        {action}
      </div>
      <div className="px-6 py-4">{children}</div>
    </Card>
  );
}

function Row({ icon, label, value, muted = false }: { icon: React.ReactNode; label: string; value: React.ReactNode; muted?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-border py-3 last:border-0">
      <span className="text-ink-muted">{icon}</span>
      <span className="w-20 shrink-0 text-sm text-ink-muted">{label}</span>
      <span className={cn("min-w-0 flex-1 truncate text-sm", muted ? "text-ink-muted" : "font-medium text-ink")}>{value}</span>
    </div>
  );
}

export function MyPageView({ me, wsId, daysLeft, maxAgeDays }: { me: Me; wsId: number; daysLeft: number | null; maxAgeDays: number | null }) {
  const [pwOpen, setPwOpen] = useState(daysLeft !== null && daysLeft <= 0);
  const [changed, setChanged] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const home = me.workspaces.find((w) => w.id === me.workspace_id);
  const expired = daysLeft !== null && daysLeft <= 0;
  const soon = daysLeft !== null && daysLeft > 0 && daysLeft <= 14;
  const ratio = daysLeft !== null && maxAgeDays ? Math.max(0, Math.min(1, daysLeft / maxAgeDays)) : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 md:p-6 xl:p-8">
      {/* 프로필 머리 */}
      <Card className="gap-0 overflow-hidden p-0">
        <div className="h-20 bg-gradient-to-r from-primary-200 via-primary-100 to-primary-50" aria-hidden />
        <div className="flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end">
          <span className="-mt-10 flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-card bg-primary-700 text-3xl font-bold text-white shadow-sm">{me.name[0]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-bold text-ink">{me.name}</h2>
              {me.title && <span className="text-sm text-ink-muted">{me.title}</span>}
              {me.company_admin && <Chip tone="dark" className="h-6 text-[11px]" title="회사 전체(전사 공통)의 관리자">회사 관리자</Chip>}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
              <span className="tabular-nums">{me.employee_no}</span>
              {me.email && <span>{me.email}</span>}
              {home && <span className="flex items-center gap-1"><House className="size-3.5" />{home.name}</span>}
            </p>
          </div>
          <Button variant="outline" size="lg" onClick={() => setPwOpen(true)} className="w-fit"><KeyRound className="size-4" /> 비밀번호 변경</Button>
        </div>
      </Card>

      {expired && <p role="alert" className="rounded-lg bg-fail-bg px-4 py-3 text-sm text-fail">비밀번호 사용 기간이 지났습니다. 아래에서 새 비밀번호로 바꿔 주세요.</p>}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-6">
          <Section icon={<IdCard className="size-4" />} title="계정 정보" desc="사내 인사 정보 기준입니다">
            <Row icon={<Hash className="size-4" />} label="사번" value={me.employee_no} />
            <Row icon={<IdCard className="size-4" />} label="이름" value={me.name} />
            <Row icon={<Briefcase className="size-4" />} label="직함" value={me.title ?? "등록 안 됨"} muted={!me.title} />
            <Row icon={<Mail className="size-4" />} label="이메일" value={me.email ?? "등록 안 됨"} muted={!me.email} />
            <p className="mt-3 flex items-start gap-2 rounded-md bg-primary-50 px-3 py-2 text-xs text-ink-muted"><Info className="mt-0.5 size-3.5 shrink-0" />정보가 다르면 관리자에게 수정을 요청해 주세요. 화면에서 직접 고치는 기능은 준비 중입니다.</p>
          </Section>

          <Section icon={<Building2 className="size-4" />} title="소속 워크스페이스" desc={`${me.workspaces.length}개 부서에서 일할 수 있습니다. 소속·역할은 관리자가 정합니다`}>
            <ul className="flex flex-col">
              {me.workspaces.map((w) => (
                <li key={w.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold", w.id === me.workspace_id ? "bg-primary-700 text-white" : "bg-primary-100 text-primary-700")}>{w.name[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/w/${w.id}/assistant`} className="truncate text-sm font-medium text-ink hover:underline">{w.name}</Link>
                      {w.id === me.workspace_id && <Chip tone="primary" className="h-5 text-[10px]" title="로그인하면 처음 열리는 부서">기본</Chip>}
                      {w.id === wsId && <Chip className="h-5 text-[10px]">지금 보는 곳</Chip>}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted">{roleLabel[w.role] ?? w.role}{w.can_configure && " · 부서 설정 가능"}</div>
                  </div>
                  <Chip tone={modeTone(modeOf(w))} className="h-5 shrink-0 text-[10px]">{modeShort[modeOf(w)]}</Chip>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Section icon={<ShieldCheck className="size-4" />} title="보안" desc="비밀번호는 정기적으로 바꿔야 합니다"
            action={!pwOpen ? <Button variant="outline" size="sm" onClick={() => setPwOpen(true)}>변경</Button> : null}>
            <div className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-ink-muted">비밀번호 사용 기간</span>
                <span className={cn("text-sm font-semibold", expired ? "text-fail" : soon ? "text-warn" : "text-ink")}>
                  {daysLeft === null ? "—" : expired ? "만료됨" : `${daysLeft}일 남음`}
                </span>
              </div>
              {ratio !== null && (
                <div className="h-2 overflow-hidden rounded-full bg-primary-100" role="progressbar" aria-valuemin={0} aria-valuemax={maxAgeDays ?? 0} aria-valuenow={Math.max(0, daysLeft ?? 0)}>
                  <div className={cn("h-full rounded-full", expired ? "bg-fail" : soon ? "bg-warn" : "bg-primary-700")} style={{ width: `${ratio * 100}%` }} />
                </div>
              )}
              {me.password_expires_at && <p className="text-xs text-ink-muted">만료일 {fmtDate(me.password_expires_at)}{maxAgeDays ? ` · ${maxAgeDays}일마다 변경` : ""}</p>}
            </div>
            {changed && <p role="status" className="mt-4 rounded-md bg-success-bg px-3 py-2 text-sm text-success">비밀번호를 바꿨습니다. 다음 로그인부터 새 비밀번호를 쓰세요.</p>}
            {pwOpen && (
              <div className="mt-4 border-t border-border pt-4">
                <PasswordChange submitLabel="비밀번호 변경" onDone={() => { setChanged(true); setPwOpen(false); }} autoFocus />
                {!expired && <button type="button" onClick={() => setPwOpen(false)} className="mt-2 w-full text-center text-xs text-ink-muted hover:text-ink">취소</button>}
              </div>
            )}
          </Section>

          <Section icon={<FileText className="size-4" />} title="개인정보" desc="수집 항목과 보관 기간">
            <Row icon={<ShieldCheck className="size-4" />} label="처리 동의" value={me.consent_required ? "동의 필요" : "동의함"} />
            <button type="button" onClick={() => setPrivacyOpen((o) => !o)} aria-expanded={privacyOpen} className="mt-2 flex w-full items-center justify-between rounded-md px-1 py-2 text-left text-sm text-ink hover:bg-primary-50">
              개인정보 처리방침 보기
              <ChevronDown className={cn("size-4 text-ink-muted transition-transform", privacyOpen && "rotate-180")} />
            </button>
            {privacyOpen && <div className="mt-2 max-h-96 overflow-y-auto rounded-lg border border-border bg-primary-50 p-4"><PrivacyText /></div>}
          </Section>
        </div>
      </div>
    </main>
  );
}
