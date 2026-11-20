"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, ChevronDown, FileText, Hash, House, IdCard, Info, KeyRound, Mail, Pencil, ShieldCheck, Briefcase } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import { PasswordChange } from "@/components/blocks/account/PasswordChange";
import { PrivacyText } from "@/components/blocks/account/PrivacyText";
import { modeOf, modeShort, modeTone } from "@/lib/mode";
import { ACCOUNT_API_READY, setPrimaryWorkspace, updateProfile } from "@/lib/api/client";
import { Input } from "@/components/ui/input";
import type { Me } from "@/lib/types/domain";

// 마이페이지 (D-5, FE-013 §3.6, #090 디자인 정리). 백엔드에 있는 것만 보여준다: GET /me, PATCH /auth/password.
// - 이름·직급·직책·이메일 정정: PATCH /me (#121). 사번·소속·역할은 관리자만
// - "기본" = me.workspace_id(로그인하면 처음 열리는 부서). 본인이 [기본으로] 지정(REQ-7, 백엔드 feat/admin-account — 병합 전에는 버튼 비활성), 지정이 없으면 서버가 admin 소속 우선으로 계산
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
  const router = useRouter();
  // 내 정보 정정 — 바뀐 칸만 보낸다. 빈 칸은 지움(이름 제외)
  const blank = { name: me.name, grade: me.grade ?? "", position: me.position ?? "", email: me.email ?? "" };
  const [edit, setEdit] = useState<typeof blank | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const emailBad = !!edit && edit.email.trim() !== "" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(edit.email.trim());
  const dirty = !!edit && (Object.keys(blank) as (keyof typeof blank)[]).some((k) => edit[k].trim() !== blank[k]);
  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!edit || saving || emailBad || !edit.name.trim()) return;
    const body = Object.fromEntries((Object.keys(blank) as (keyof typeof blank)[]).filter((k) => edit[k].trim() !== blank[k]).map((k) => [k, edit[k].trim()]));
    setSaving(true); setProfileMsg(null);
    const r = await updateProfile(body);
    setSaving(false);
    if (!r.ok) { setProfileMsg({ ok: false, text: r.message }); return; }
    setEdit(null); setProfileMsg({ ok: true, text: "내 정보를 고쳤습니다" });
    router.refresh();
  };
  const [primaryBusy, setPrimaryBusy] = useState<number | null>(null);
  const [primaryMsg, setPrimaryMsg] = useState<string | null>(null);
  const makePrimary = async (id: number, name: string) => {
    setPrimaryBusy(id); setPrimaryMsg(null);
    const r = await setPrimaryWorkspace(id);
    setPrimaryBusy(null);
    setPrimaryMsg(r.ok ? `기본 부서를 ${name}(으)로 바꿨습니다 — 다음 로그인부터 이 부서가 먼저 열립니다` : r.message);
    if (r.ok) router.refresh();
  };
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
              {me.company_admin && <Chip tone="dark" className="h-6 text-xs" title="회사 전체(전사 공통)의 관리자">회사 관리자</Chip>}
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
          <Section icon={<IdCard className="size-4" />} title="계정 정보" desc="이름·직급·직책·이메일은 직접 고칠 수 있습니다"
            action={!edit && <Button size="sm" variant="outline" onClick={() => { setEdit(blank); setProfileMsg(null); }}><Pencil className="size-3.5" /> 수정</Button>}>
            <Row icon={<Hash className="size-4" />} label="사번" value={me.employee_no} />
            {edit ? (
              <form onSubmit={saveProfile} className="flex flex-col gap-3 pt-3">
                <label className="flex flex-col gap-1 text-sm text-ink-muted">이름<Input className="h-10" value={edit.name} maxLength={50} required onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1 text-sm text-ink-muted">직급<Input className="h-10" value={edit.grade} maxLength={30} placeholder="예: 과장" onChange={(e) => setEdit({ ...edit, grade: e.target.value })} /></label>
                  <label className="flex flex-col gap-1 text-sm text-ink-muted">직책<Input className="h-10" value={edit.position} maxLength={30} placeholder="예: 팀장" onChange={(e) => setEdit({ ...edit, position: e.target.value })} /></label>
                </div>
                <label className="flex flex-col gap-1 text-sm text-ink-muted">이메일<Input className="h-10" type="email" value={edit.email} maxLength={254} aria-invalid={emailBad} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
                  {emailBad && <span className="text-xs text-fail">이메일 형식이 아닙니다</span>}</label>
                <p className="text-xs text-ink-muted">직급·직책·이메일은 비우면 지워집니다. 바꾼 항목 이름은 접속 기록에 남습니다.</p>
                {profileMsg && !profileMsg.ok && <p role="alert" className="rounded-md bg-fail-bg px-3 py-2 text-sm text-fail">{profileMsg.text}</p>}
                <div className="flex gap-2">
                  <Button type="submit" size="sm" disabled={saving || !dirty || emailBad || !edit.name.trim()} className="bg-primary-700 text-white hover:bg-primary-800">{saving ? "저장 중…" : "저장"}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEdit(null); setProfileMsg(null); }}>취소</Button>
                </div>
              </form>
            ) : (
              <>
                <Row icon={<IdCard className="size-4" />} label="이름" value={me.name} />
                <Row icon={<Briefcase className="size-4" />} label="직함" value={me.title ?? "등록 안 됨"} muted={!me.title} />
                <Row icon={<Mail className="size-4" />} label="이메일" value={me.email ?? "등록 안 됨"} muted={!me.email} />
                {profileMsg?.ok && <p role="status" className="mt-3 text-xs text-ink-muted">{profileMsg.text}</p>}
                <p className="mt-3 flex items-start gap-2 rounded-md bg-primary-50 px-3 py-2 text-xs text-ink-muted"><Info className="mt-0.5 size-3.5 shrink-0" />사번·소속·역할은 관리자가 정합니다.</p>
              </>
            )}
          </Section>

          <Section icon={<Building2 className="size-4" />} title="소속 워크스페이스" desc={`${me.workspaces.length}개 부서에서 일할 수 있습니다. 소속·역할은 관리자가 정합니다`}>
            <ul className="flex flex-col">
              {me.workspaces.map((w) => (
                <li key={w.id} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
                  <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold", w.id === me.workspace_id ? "bg-primary-700 text-white" : "bg-primary-100 text-primary-700")}>{w.name[0]}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Link href={`/w/${w.id}/assistant`} className="truncate text-sm font-medium text-ink hover:underline">{w.name}</Link>
                      {w.id === me.workspace_id && <Chip tone="primary" className="h-5 text-xs" title="로그인하면 처음 열리는 부서">기본</Chip>}
                      {w.id === wsId && <Chip className="h-5 text-xs">지금 보는 곳</Chip>}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted">{roleLabel[w.role] ?? w.role}{w.can_configure && " · 부서 설정 가능"}</div>
                  </div>
                  <Chip tone={modeTone(modeOf(w))} className="h-5 shrink-0 text-xs">{modeShort[modeOf(w)]}</Chip>
                  {me.workspaces.length > 1 && w.id !== me.workspace_id && (
                    <Button size="xs" variant="outline" className="shrink-0" disabled={!ACCOUNT_API_READY || primaryBusy !== null} onClick={() => makePrimary(w.id, w.name)}
                      title={ACCOUNT_API_READY ? "로그인하면 이 부서가 먼저 열리게 합니다" : "서버 준비 중입니다(REQ-7)"}>기본으로</Button>
                  )}
                </li>
              ))}
            </ul>
            {primaryMsg && <p role="status" className="mt-2 text-xs text-ink-muted">{primaryMsg}</p>}
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
