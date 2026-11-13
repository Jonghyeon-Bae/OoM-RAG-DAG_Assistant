"use client";
import { useEffect, useRef, useState } from "react";
import { Download, FileUp, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Chip, Field, cn } from "@/components/ui";
import { downloadUploadFile, fetchUpload, fetchUploads, uploadAction, uploadPolicy } from "@/lib/api/client";
import type { PolicyDocument, PolicyUpload, UploadStatus } from "@/lib/types/domain";

// 규정 파일 올리기 → (AI 워커) 자동 변환 → 검수(변환본 확인·수정) → 승인 → (AI 워커) 등록 (백엔드 #44, #109)
// 상태: converting → review ⇄(변환본 저장 시 converting) → indexing → approved / rejected / failed → retry
const statusLabel: Record<UploadStatus, string> = { converting: "변환 중", review: "검수 대기", indexing: "등록 중", approved: "등록됨", rejected: "반려", failed: "변환 실패" };
const statusTone: Record<UploadStatus, "neutral" | "primary" | "warn" | "fail" | "dark"> = { converting: "neutral", review: "warn", indexing: "neutral", approved: "primary", rejected: "dark", failed: "fail" };
const working = (s: UploadStatus) => s === "converting" || s === "indexing";
const ACCEPT = ".pdf,.hwp,.hwpx,.docx,.md,.txt";
const SLUG = /^[a-z0-9][a-z0-9-]{2,79}$/;
const fmtAt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-");
const size = (b: number) => (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(b / 1024))}KB`);
// 파일 이름에서 문서 ID 후보 — 영문·숫자만 남긴다(한글 이름이면 빈 칸 → 직접 입력)
const slugFrom = (name: string) => name.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

export function UploadsPanel({ wsId, initial, docs, canUpload, companyAdmin, onApproved }: {
  wsId: number; initial: PolicyUpload[]; docs: PolicyDocument[]; canUpload: boolean; companyAdmin: boolean; onApproved: () => void;
}) {
  const [items, setItems] = useState(initial);
  const [openId, setOpenId] = useState<number | null>(initial.find((u) => u.status === "review")?.id ?? null);
  const anyWorking = items.some((u) => working(u.status));
  const itemsRef = useRef(items);
  useEffect(() => { itemsRef.current = items; }, [items]);

  // 변환·등록은 워커가 한다 — 진행 중인 건이 있는 동안만 3초마다 목록을 다시 읽는다. 등록이 끝나면 문서 목록도 갱신
  useEffect(() => {
    if (!anyWorking) return;
    const t = setInterval(async () => {
      const next = await fetchUploads(wsId);
      const done = itemsRef.current.some((p) => p.status === "indexing" && next.find((n) => n.id === p.id)?.status === "approved");
      setItems(next);
      if (done) onApproved();
    }, 3000);
    return () => clearInterval(t);
  }, [anyWorking, wsId, onApproved]);

  const added = (u: PolicyUpload) => { setItems((p) => [u, ...p]); setOpenId(u.id); };
  const changed = (u: PolicyUpload) => setItems((p) => p.map((x) => (x.id === u.id ? { ...x, ...u, markdown: null } : x)));

  return (
    <div className="grid items-start gap-4 sm:gap-6 lg:grid-cols-[minmax(300px,380px)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        {canUpload ? <UploadForm wsId={wsId} docs={docs} companyAdmin={companyAdmin} onAdded={added} /> : (
          <Card className="p-4 text-sm text-ink-muted">규정 파일은 부서 관리자가 올립니다. 여기서는 진행 상황과 변환 결과를 볼 수 있습니다.</Card>
        )}
        <Card className="min-w-0 gap-0 p-0">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold text-ink">올린 파일</h2>
            {anyWorking && <span className="flex items-center gap-1 text-xs text-ink-muted"><Loader2 className="size-3 animate-spin" /> 처리 중 — 자동으로 갱신</span>}
          </div>
          <ul className="divide-y divide-border">
            {items.map((u) => (
              <li key={u.id}>
                <button type="button" onClick={() => setOpenId(u.id)} className={cn("flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-primary-50", openId === u.id && "bg-primary-50")}>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Chip tone={statusTone[u.status]} className="h-5 text-xs">{working(u.status) && <Loader2 className="mr-1 size-3 animate-spin" />}{statusLabel[u.status]}</Chip>
                    <span className="text-sm font-medium text-ink">{u.title} {u.version}</span>
                  </span>
                  <span className="truncate text-xs text-ink-muted">{u.original_name} · {size(u.size_bytes)} · {u.uploaded_by ?? "-"} · {fmtAt(u.created_at)}</span>
                </button>
              </li>
            ))}
            {!items.length && <li className="px-4 py-6 text-center text-sm text-ink-muted">올린 파일이 없습니다.</li>}
          </ul>
        </Card>
      </div>
      {openId ? <UploadDetail key={openId} wsId={wsId} id={openId} onChanged={changed} onApproved={onApproved} /> : (
        <Card className="p-8 text-center text-sm text-ink-muted">왼쪽에서 파일을 고르면 변환 결과를 검수할 수 있습니다.</Card>
      )}
    </div>
  );
}

function UploadForm({ wsId, docs, companyAdmin, onAdded }: { wsId: number; docs: PolicyDocument[]; companyAdmin: boolean; onAdded: (u: PolicyUpload) => void }) {
  const empty = { title: "", version: "", slug: "", doc_type: "", supersedes: "", scope: "dept" as "dept" | "company" };
  const [f, setF] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slugOk = SLUG.test(f.slug);
  const ready = !!file && f.title.trim() && f.version.trim() && slugOk && !busy;
  const replaceable = docs.filter((d) => d.status === "active" && d.can_manage);
  const pick = (d: PolicyDocument | undefined) => setF((x) => ({ ...x, supersedes: d?.slug ?? "", title: d && !x.title ? d.title : x.title, doc_type: d && !x.doc_type ? d.doc_type ?? "" : x.doc_type, scope: d ? (d.visibility === "company" ? "company" : "dept") : x.scope }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ready || !file) return;
    setBusy(true); setError(null);
    const r = await uploadPolicy(wsId, { file, title: f.title.trim(), version: f.version.trim(), slug: f.slug, doc_type: f.doc_type.trim() || undefined, supersedes: f.supersedes || undefined, scope: f.scope });
    setBusy(false);
    if (!r.ok) { setError(r.message); return; }
    setF(empty); setFile(null); (e.target as HTMLFormElement).reset();
    onAdded(r.upload);
  };
  return (
    <Card className="min-w-0 gap-3 p-4 sm:p-5">
      <h2 className="flex items-center gap-2 font-semibold text-ink"><FileUp className="size-4" /> 규정 파일 올리기</h2>
      <p className="text-xs text-ink-muted">PDF · HWP · HWPX · Word · MD · TXT (최대 30MB). 올리면 조문으로 자동 변환되고, 검수·승인 뒤에 어시스턴트가 검색합니다.</p>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <Field label="파일" htmlFor="up-file">
          <input id="up-file" type="file" accept={ACCEPT} required onChange={(e) => { const fl = e.target.files?.[0] ?? null; setFile(fl); if (fl && !f.slug) setF((x) => ({ ...x, slug: slugFrom(fl.name) })); }} className="text-sm file:mr-3 file:rounded-md file:border file:border-border file:bg-card file:px-3 file:py-1.5 file:text-sm" />
        </Field>
        <Field label="새 판으로 교체할 문서 (선택)" htmlFor="up-sup" hint="고르면 승인 때 그 문서가 자동으로 폐기되고 이 파일이 새 판이 됩니다.">
          <select id="up-sup" value={f.supersedes} onChange={(e) => pick(replaceable.find((d) => d.slug === e.target.value))} className="h-10 w-full rounded-md border border-border bg-white px-2 text-sm pointer-coarse:h-11">
            <option value="">새 규정 (교체 없음)</option>
            {replaceable.map((d) => <option key={d.id} value={d.slug}>{d.title} {d.version}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-[1fr_120px] gap-2">
          <Field label="문서 제목" htmlFor="up-title"><Input id="up-title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="예: 배포·장애 대응 운영지침" required /></Field>
          <Field label="판" htmlFor="up-ver"><Input id="up-ver" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} placeholder="2027-01" required /></Field>
        </div>
        <Field label="문서 ID" htmlFor="up-slug" hint="영문 소문자·숫자·하이픈 3~80자. 판마다 달라야 합니다(예: retail-deploy-2027-01).">
          <Input id="up-slug" value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase() })} aria-invalid={!!f.slug && !slugOk} placeholder="retail-deploy-2027-01" required />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="종류 (선택)" htmlFor="up-type"><Input id="up-type" value={f.doc_type} onChange={(e) => setF({ ...f, doc_type: e.target.value })} placeholder="지침 · 규정 · FAQ" /></Field>
          <Field label="적용 범위">
            <div role="radiogroup" className="flex h-10 items-center gap-3 text-sm pointer-coarse:h-11">
              <label className="flex items-center gap-1.5"><input type="radio" checked={f.scope === "dept"} onChange={() => setF({ ...f, scope: "dept" })} /> 이 부서</label>
              <label className={cn("flex items-center gap-1.5", !companyAdmin && "opacity-40")} title={companyAdmin ? undefined : "전사 공통 규정은 회사 관리자만 올립니다"}><input type="radio" disabled={!companyAdmin} checked={f.scope === "company"} onChange={() => setF({ ...f, scope: "company" })} /> 전사 공통</label>
            </div>
          </Field>
        </div>
        {error && <p className="text-sm text-fail">{error}</p>}
        <Button type="submit" size="lg" disabled={!ready}>{busy ? "올리는 중…" : "올리고 변환 시작"}</Button>
      </form>
    </Card>
  );
}

function UploadDetail({ wsId, id, onChanged, onApproved }: { wsId: number; id: number; onChanged: (u: PolicyUpload) => void; onApproved: () => void }) {
  const [u, setU] = useState<PolicyUpload | null>(null);
  const [md, setMd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const status = u?.status;

  useEffect(() => {
    let alive = true;
    fetchUpload(wsId, id).then((x) => { if (alive && x) { setU(x); setMd(x.markdown ?? ""); } });
    return () => { alive = false; };
  }, [wsId, id]);
  // 변환·등록 중이면 3초마다 다시 읽는다. 끝나면 멈춘다
  useEffect(() => {
    if (!status || !working(status)) return;
    const t = setInterval(async () => {
      const x = await fetchUpload(wsId, id);
      if (!x) return;
      setU(x); setMd(x.markdown ?? ""); onChanged(x);
      if (x.status === "approved") onApproved();
    }, 3000);
    return () => clearInterval(t);
  }, [status, wsId, id, onChanged, onApproved]);

  if (!u) return <Card className="p-8 text-center text-sm text-ink-muted"><Loader2 className="mx-auto size-4 animate-spin" /></Card>;
  const r = u.report ?? {};
  const edited = (u.markdown ?? "") !== md;
  const act = async (action: "markdown" | "approve" | "reject" | "retry", body?: { markdown?: string; reason?: string }) => {
    setBusy(true); setMsg(null);
    const res = await uploadAction(wsId, u.id, action, body);
    setBusy(false);
    if (!res.ok) { setMsg(res.message); return; }
    setU(res.upload); setMd(res.upload.markdown ?? md); onChanged(res.upload); setRejecting(null);
  };
  const download = async (kind: "original" | "markdown") => {
    const res = await downloadUploadFile(wsId, u.id, kind, kind === "original" ? u.original_name : `${u.slug}.md`);
    if (!res.ok) setMsg(res.message);
  };
  const review = u.status === "review" && u.can_manage;

  return (
    <Card className="min-w-0 gap-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip tone={statusTone[u.status]} className="h-5 text-xs">{working(u.status) && <Loader2 className="mr-1 size-3 animate-spin" />}{statusLabel[u.status]}</Chip>
            <h2 className="font-semibold text-ink">{u.title} {u.version}</h2>
          </div>
          <p className="mt-1 text-xs text-ink-muted">{u.original_name} · {u.format.toUpperCase()} · {size(u.size_bytes)} · 문서 ID {u.slug}{u.supersedes && ` · 교체 대상 ${u.supersedes}`}</p>
          <p className="text-xs text-ink-muted">올림 {u.uploaded_by ?? "-"} {fmtAt(u.created_at)}{u.reviewed_by && ` · 검수 ${u.reviewed_by} ${fmtAt(u.reviewed_at)}`}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <Button size="xs" variant="outline" onClick={() => download("original")}><Download className="size-3" /> 원본</Button>
          {u.markdown && <Button size="xs" variant="outline" onClick={() => download("markdown")}><Download className="size-3" /> 변환본</Button>}
        </div>
      </div>

      {u.status === "converting" && <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm">조문으로 변환하는 중입니다. 끝나면 이 자리에 변환 결과가 나옵니다.</p>}
      {u.status === "indexing" && <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm">승인됐습니다. 검색할 수 있게 등록하는 중입니다.</p>}
      {u.status === "approved" && <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm">등록됐습니다{r.indexed ? ` — 조문 ${r.indexed.chunks}조각` : ""}. &ldquo;등록된 문서&rdquo; 탭에서 볼 수 있고, 어시스턴트가 이제 이 문서를 검색합니다.</p>}
      {u.status === "rejected" && <p className="rounded-lg bg-ref-bg px-3 py-2 text-sm">반려됨{u.reject_reason && ` — ${u.reject_reason}`}</p>}
      {u.status === "failed" && <p className="rounded-lg bg-fail-bg px-3 py-2 text-sm text-fail">변환 실패{u.error && ` — ${u.error}`}</p>}

      {(r.article_count != null || r.extract) && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-ink">변환 결과</h3>
          <div className="flex flex-wrap gap-1.5 text-xs">
            <Chip tone={r.article_count ? "primary" : "fail"} className="h-5 text-xs">조문 {r.article_count ?? 0}개</Chip>
            {r.extract?.pages != null && <Chip className="h-5 text-xs">{r.extract.pages}쪽</Chip>}
            {!!r.extract?.ocr_pages?.length && <Chip tone="warn" className="h-5 text-xs">OCR {r.extract.ocr_pages.length}쪽</Chip>}
            {!!r.ocr_suspects?.length && <Chip tone="warn" className="h-5 text-xs">확인할 줄 {r.ocr_suspects.length}</Chip>}
          </div>
          {!!r.warnings?.length && (
            <ul className="flex flex-col gap-1 rounded-lg bg-warn-bg/60 p-3 text-xs text-ink">
              {r.warnings.map((w, i) => <li key={i}>⚠ {w}</li>)}
            </ul>
          )}
          {!!r.ocr_suspects?.length && (
            <details className="rounded-lg border border-border p-3 text-xs">
              <summary className="cursor-pointer font-medium text-ink">원본과 대조할 줄 {r.ocr_suspects.length}개</summary>
              <ul className="mt-2 flex flex-col gap-1">{r.ocr_suspects.map((s) => <li key={s.line} className="font-mono"><span className="text-ink-muted">{s.line}행</span> {s.text}</li>)}</ul>
            </details>
          )}
          {!!r.articles?.length && (
            <details className="rounded-lg border border-border p-3 text-xs" open={u.status === "review"}>
              <summary className="cursor-pointer font-medium text-ink">조문 미리보기 {r.articles.length}개</summary>
              <ol className="mt-2 flex max-h-72 flex-col gap-1 overflow-y-auto">
                {r.articles.map((a, i) => (
                  <li key={i} className={cn("flex gap-2", !a.article && "text-ink-muted")}>
                    <span className="w-36 shrink-0 truncate font-medium" title={a.label}>{a.label}</span>
                    <span className="min-w-0 flex-1 truncate">{a.head}</span>
                    <span className="shrink-0 tabular-nums text-ink-muted">{a.chars}자</span>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      )}

      {u.markdown != null && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">변환본 (Markdown)</h3>
            {review && <span className="text-xs text-ink-muted">고치고 저장하면 조문 미리보기를 다시 만듭니다</span>}
          </div>
          <Textarea value={md} onChange={(e) => setMd(e.target.value)} readOnly={!review} className="min-h-72 font-mono text-xs leading-relaxed" />
        </div>
      )}

      {msg && <p className="text-sm text-fail">{msg}</p>}
      {u.can_manage && (u.status === "review" || u.status === "failed") && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {rejecting !== null ? (
            <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (rejecting.trim()) act("reject", { reason: rejecting.trim() }); }}>
              <Input autoFocus value={rejecting} onChange={(e) => setRejecting(e.target.value)} placeholder="반려 사유 (예: 원본이 구판입니다)" />
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={busy || !rejecting.trim()}>반려</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setRejecting(null)}>취소</Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-2">
              {u.status === "review" && <Button size="sm" disabled={busy || edited || !r.article_count} title={edited ? "고친 변환본을 먼저 저장하세요" : !r.article_count ? "조문이 0개라 승인할 수 없습니다" : undefined} onClick={() => act("approve")}>승인하고 등록</Button>}
              {u.status === "review" && <Button size="sm" variant="outline" disabled={busy || !edited || !md.trim()} onClick={() => act("markdown", { markdown: md })}>변환본 저장</Button>}
              {u.status === "failed" && <Button size="sm" variant="outline" disabled={busy} onClick={() => act("retry")}>다시 변환</Button>}
              <Button size="sm" variant="ghost" className="text-fail" disabled={busy} onClick={() => setRejecting("")}>반려</Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
