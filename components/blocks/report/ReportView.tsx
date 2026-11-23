"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Eye, Loader2, Printer, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import { createReport, fetchReports } from "@/lib/api/client";
import { aiEmpty, aiStateOf, groupPolicy, EMPTY, fmtDateTime, fmtDuration, fmtShort, kindLabel, relationText, reportMarkdown, type AiState } from "@/lib/report/format";
import type { Report, ReportAudience, ReportKind, ReportSentence } from "@/lib/types/report";

// 장애 보고서 R1 화면 (FE-REQ-005 확정 템플릿). 섹션 순서·제목은 고정이고 비어도 지우지 않는다.
// 내용 = 백엔드 /reports (회신 11/18 §3.6 흐름, #118): 들어오면 목록 → 없으면 만들기 → generating 이면 5초 간격 재조회(1분에서 멈춤)
//   → stale·failed 는 [다시 만들기](force). stale 이어도 자동으로 다시 만들지 않는다(비용·읽던 문장이 말없이 바뀜).
// 지킬 것(§3.7): 목록은 audience 로 고른다 · 완료본이 보이는 중 [다시 만들기] 응답으로 화면을 덮지 않는다 · 보고서 id 를 저장하지 않는다 · done 의 빈 칸은 실패가 아니다.
const kindTone: Record<ReportKind, "fail" | "primary" | "neutral" | "warn" | "dark"> = { occurrence: "fail", cause: "fail", resolution: "primary", action: "neutral", side_issue: "warn", reference: "neutral" };
const POLL_MS = 5000, POLL_MAX = 12; // 5초 × 12 = 1분

type ByAudience = Partial<Record<ReportAudience, Report>>;

export function ReportView({ wsId, rootId, canExternal }: { wsId: number; rootId: number; canExternal: boolean }) {
  const [audience, setAudience] = useState<ReportAudience>("internal");
  const [reports, setReports] = useState<ByAudience | null>(null); // null = 첫 조회 전
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [actErr, setActErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false); // 인쇄 미리보기 — A4 폭 종이 모양으로 본 뒤 인쇄(#121)
  const tried = useRef(new Set<ReportAudience>()); // 자동 첫 생성은 대상마다 한 번만

  const apply = (r: Awaited<ReturnType<typeof fetchReports>>) => {
    if (!r.ok) { setLoadErr(r.message); return; }
    setLoadErr(null);
    setReports(Object.fromEntries(r.items.map((x) => [x.audience, x])) as ByAudience);
  };
  const load = useCallback(async () => apply(await fetchReports(wsId, rootId)), [wsId, rootId]);

  const create = useCallback(async (aud: ReportAudience, force: boolean) => {
    setBusy(true);
    setActErr(null);
    const r = await createReport(wsId, { root_id: rootId, audience: aud, force });
    setBusy(false);
    if (!r.ok) { setActErr(r.message); return; }
    setTimedOut(false);
    setReports((m) => {
      const prev = m?.[aud];
      // 완료본이 보이는 중이고 새 요청이 아직 안 끝났으면 화면은 그대로, "새로 만드는 중"만 켠다(§3.7 ②)
      const keep = prev?.status === "done" && r.report.id !== prev.id && r.report.status !== "done";
      return { ...m, [aud]: keep ? { ...prev, pending_status: r.report.status === "failed" ? "failed" : "generating" } : r.report };
    });
  }, [wsId, rootId]);

  useEffect(() => {
    let alive = true;
    fetchReports(wsId, rootId).then((r) => { if (alive) apply(r); });
    return () => { alive = false; };
  }, [wsId, rootId]);

  const cur = reports?.[audience] ?? null;
  const canCreate = audience === "internal" || canExternal;
  // 첫 생성 — 그 대상의 보고서가 없을 때만. 같은 내용이면 서버가 있는 것을 돌려준다(§3.6)
  useEffect(() => {
    if (!reports || reports[audience] || !canCreate || tried.current.has(audience)) return;
    tried.current.add(audience);
    void create(audience, false);
  }, [reports, audience, canCreate, create]);

  const waiting = !!cur && (cur.status === "generating" || cur.pending_status === "generating");
  useEffect(() => {
    if (!waiting || timedOut) return;
    let n = 0;
    const t = setInterval(() => {
      n += 1;
      void load();
      if (n >= POLL_MAX) { clearInterval(t); setTimedOut(true); }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [waiting, timedOut, load]);

  const pick = (a: ReportAudience) => { setAudience(a); setActErr(null); setTimedOut(false); };
  const refresh = () => { setTimedOut(false); void load(); };
  // 외부판: 만들기는 부서 관리자만, 보기는 구성원 모두(§3.8) — 이미 있으면 누구나 연다
  const externalOpen = canExternal || !!reports?.external;

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 print:hidden">
      <Link href={`/w/${wsId}/timeline?entry=${rootId}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-sm text-ink hover:bg-primary-50 pointer-coarse:min-h-11"><ArrowLeft className="size-4" /> 타임라인</Link>
      <div role="radiogroup" aria-label="공개 수준" className="flex rounded-lg bg-primary-50 p-0.5">
        {(["internal", "external"] as const).map((a) => (
          <button key={a} type="button" role="radio" aria-checked={audience === a} disabled={a === "external" && !externalOpen}
            title={a === "external" && !externalOpen ? "외부 공개용은 부서 관리자만 만들 수 있습니다" : undefined}
            onClick={() => pick(a)}
            className={cn("h-8 rounded-md px-3 text-sm pointer-coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-40", audience === a ? "bg-primary-700 font-semibold text-white" : "text-ink-muted")}>
            {a === "internal" ? "내부용" : "외부 공개용"}
          </button>
        ))}
      </div>
      {cur && (
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={async () => { await navigator.clipboard?.writeText(reportMarkdown(cur.content, audience, aiStateOf(cur))); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            <Copy className="size-3.5" /> {copied ? "복사됨" : "Markdown 복사"}
          </Button>
          <Button size="sm" onClick={() => { setPreview(true); window.scrollTo({ top: 0 }); }}><Eye className="size-3.5" /> 인쇄 미리보기</Button>
        </div>
      )}
    </div>
  );

  if (loadErr && !reports) {
    return (
      <main className="flex flex-col gap-4 p-3 md:p-6 xl:p-8">
        {toolbar}
        <Notice tone="fail">보고서를 불러오지 못했습니다 — {loadErr} <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="size-3.5" /> 다시 시도</Button></Notice>
      </main>
    );
  }
  if (!cur) {
    return (
      <main className="flex flex-col gap-4 p-3 md:p-6 xl:p-8">
        {toolbar}
        {!reports || busy ? (
          <Notice><Loader2 className="size-4 animate-spin" /> {reports ? "보고서를 만드는 중입니다 — 사실 칸은 곧 보입니다" : "보고서를 불러오는 중…"}</Notice>
        ) : (
          <Notice tone={actErr ? "fail" : undefined}>
            {actErr ? `보고서를 만들지 못했습니다 — ${actErr}` : "아직 이 대상의 보고서가 없습니다."}
            {canCreate && <Button size="sm" variant="outline" onClick={() => void create(audience, false)}>만들기</Button>}
          </Notice>
        )}
      </main>
    );
  }

  const c = cur.content;
  const internal = audience === "internal";
  const ai = aiStateOf(cur);
  const regen = <Button size="sm" variant="outline" disabled={busy} onClick={() => void create(audience, true)}><RefreshCw className={cn("size-3.5", busy && "animate-spin")} /> 다시 만들기</Button>;
  // 근거 번호 → 원 기록(타임라인). AI 문장 확인용(§3.6)
  const idOf = new Map(c.records.map((r) => [r.ref, r.id]));
  const to = (ref: string) => { const id = idOf.get(ref); return id ? `/w/${wsId}/timeline?entry=${id}` : null; };
  const aiTag = (ai === "done" || cur.pending_status) && c.summary.length > 0 && <AiTag />;

  // 미리보기 줄 — 종이에 나오지 않는 것(도구·상태 안내)을 걷어 내고 A4 폭으로 보여 준다. 쪽 경계선은 대략(표·섹션이 쪽을 넘지 않게 밀리면 달라진다)
  const previewBar = (
    <div className="sticky top-0 z-10 flex w-full flex-wrap items-center gap-2 rounded-lg bg-card px-3 py-2 shadow-sm ring-1 ring-foreground/10 print:hidden">
      <span className="text-sm font-semibold text-ink">인쇄 미리보기</span>
      <span className="text-xs text-ink-muted">A4 세로 · 여백 14mm · 점선 = 쪽 경계(대략){!internal && " · 외부 공개용"}</span>
      <div className="ml-auto flex gap-2">
        <Button size="sm" onClick={() => window.print()}><Printer className="size-3.5" /> 인쇄·PDF 저장</Button>
        <Button size="sm" variant="outline" onClick={() => setPreview(false)}><X className="size-3.5" /> 닫기</Button>
      </div>
    </div>
  );

  return (
    <main className={cn("flex flex-col gap-4 p-3 md:p-6 xl:p-8 print:block print:p-0", preview && "items-center bg-primary-100/60 print:bg-transparent")}>
      {preview ? previewBar : toolbar}
      {/* 상태 안내 — 인쇄에는 나오지 않는다. error 원문은 보이지 않는다(§6) */}
      <div className={cn("flex flex-col gap-2 print:hidden", preview && "hidden")} aria-live="polite">
        {cur.status === "generating" && (timedOut
          ? <Notice tone="warn">아직 AI 문장을 만드는 중입니다. 잠시 뒤 새로 고쳐 보세요. <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="size-3.5" /> 새로고침</Button></Notice>
          : <Notice><Loader2 className="size-4 animate-spin" /> AI 문장 칸을 작성하는 중입니다 — 사실 칸은 지금 기록 그대로입니다</Notice>)}
        {cur.pending_status === "generating" && (timedOut
          ? <Notice tone="warn">새 보고서를 아직 만드는 중입니다 — 지금은 이전 보고서입니다. <Button size="sm" variant="outline" onClick={refresh}><RefreshCw className="size-3.5" /> 새로고침</Button></Notice>
          : <Notice><Loader2 className="size-4 animate-spin" /> 새로 만드는 중 — 완성되면 바뀝니다. 지금은 {fmtDateTime(cur.generated_at)}에 만든 보고서입니다</Notice>)}
        {ai === "off" && !cur.pending_status && !cur.stale && <Notice>AI 문장 없이 만든 보고서입니다. 서버에 AI 키를 넣었다면 다시 만들 수 있습니다. {regen}</Notice>}
        {cur.status === "failed" && <Notice tone="fail">AI 문장 칸을 만들지 못했습니다. 사실 칸은 기록 그대로입니다. {regen}</Notice>}
        {cur.pending_status === "failed" && <Notice tone="fail">다시 만들지 못했습니다 — 이전 보고서를 보여 줍니다. {regen}</Notice>}
        {cur.stale && cur.status !== "generating" && cur.pending_status !== "generating" && cur.status !== "failed" && cur.pending_status !== "failed" && (
          <Notice tone="warn">보고서를 만든 뒤 장애 건의 기록이 바뀌었습니다. {regen}</Notice>
        )}
        {actErr && <Notice tone="fail">{actErr}</Notice>}
        {!internal && <Notice tone="warn">외부로 보내기 전에 한 번 읽어 주세요 — 작성자·보고자 이름은 지웠지만, 기록 본문에 적힌 사람 이름은 남아 있을 수 있습니다.</Notice>}
      </div>

      <article className={cn("text-sm leading-relaxed text-ink print:w-auto print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0",
        preview ? "report-sheet w-[210mm] max-w-full bg-white p-4 shadow-md sm:p-[14mm]" : "mx-auto w-full max-w-4xl rounded-2xl bg-card p-4 shadow-sm ring-1 ring-foreground/10 sm:p-8")}>
        {!internal && <div className="mb-3 rounded bg-primary-700 px-3 py-1 text-center text-xs font-semibold text-white">외부 공개용</div>}
        {c.meta.interim && <div className="mb-3 rounded bg-warn-bg px-3 py-1 text-center text-xs font-semibold text-ink ring-1 ring-warn/40">중간 보고 — 아직 진행 중인 장애 건입니다</div>}
        <h1 className="text-xl font-bold leading-snug sm:text-2xl">{c.meta.interim ? "[장애 중간 보고서]" : "[장애 보고서]"} {c.meta.title}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-primary-50 p-3 text-xs sm:grid-cols-4 print:bg-transparent print:ring-1 print:ring-border">
          <Meta k="부서" v={c.meta.workspace_name} />
          <Meta k="장애 건" v={`#${c.meta.root_id}`} />
          <Meta k="상태" v={c.meta.status === "resolved" ? "완료" : c.meta.status === "open" ? "진행 중" : "참고"} />
          <Meta k="소요" v={fmtDuration(c.meta.duration_minutes, c.meta.first_reported_at)} />
          <Meta k="최초 기록" v={fmtDateTime(c.meta.first_reported_at)} />
          <Meta k="완료" v={fmtDateTime(c.meta.resolved_at)} />
          <Meta k="근거 기록" v={`${c.meta.record_count}건${c.meta.truncated ? " (일부)" : ""}`} />
          <Meta k="작성" v={metaWrite(ai, cur.generated_at)} />
        </dl>

        <Sec n="1" title="한눈에 보기" tag={aiTag}>
          {c.summary.length ? <Sentences s={c.summary} to={to} /> : <Empty>{aiEmpty(ai)}</Empty>}
          {/* 옛 판(지시문 1)만 — 새 판(2~)은 원인 표시가 없으면 원인 문장을 싣지 않는다(백엔드 PR #52) */}
          {cur.prompt_version === "1" && c.summary.length > 0 && !c.causes.length && <p className="mt-1 text-xs text-ink-muted print:hidden">원인으로 표시된 기록이 없습니다 — 원인을 말하는 문장이 있다면 AI 의 추정입니다.</p>}
        </Sec>

        <Sec n="2" title="발생 현황">
          <ul className="flex flex-col gap-1">
            <li><b>최초 증상</b> {c.occurrence.symptom}</li>
            <li><b>오류 코드</b> {c.occurrence.error_codes.join(", ") || "-"} · <b>최초 기록</b> {fmtDateTime(c.occurrence.reported_at)}{c.occurrence.reported_by && ` (${c.occurrence.reported_by})`}</li>
            <li><b>영향</b> {c.impact.length ? <><Sentences s={c.impact} inline to={to} /> <AiTag inline /></> : <Empty inline>{aiEmpty(ai)}</Empty>}</li>
          </ul>
        </Sec>

        <Sec n="3" title="경과">
          <Table head={["일시", "구분", "내용", "기록", ...(internal ? ["작성자"] : [])]}>
            {c.timeline.map((t) => (
              <tr key={t.ref}>
                <td className="whitespace-nowrap tabular-nums">{fmtShort(t.at)}</td>
                <td><Chip tone={kindTone[t.kind]} className="h-5 text-xs">{kindLabel[t.kind]}</Chip></td>
                <td>{t.title}</td>
                <td className="font-mono text-xs">{t.ref}</td>
                {internal && <td className="whitespace-nowrap text-ink-muted">{t.author}</td>}
              </tr>
            ))}
          </Table>
        </Sec>

        <Sec n="4" title="원인">
          {c.causes.length ? (
            <ul className="flex flex-col gap-2">
              {c.causes.map((x) => (
                <li key={x.ref}>
                  <b><Ref r={x.ref} /> {x.title}</b>
                  <div className="text-ink-muted">{x.explanation ? <Sentences s={[x.explanation]} inline to={to} /> : ai === "writing" && <Empty inline>{aiEmpty(ai)}</Empty>}{x.link_reason && <span> · 연결 이유: {x.link_reason}</span>}</div>
                </li>
              ))}
            </ul>
          ) : <Empty>{EMPTY.causes}</Empty>}
        </Sec>

        <Sec n="5" title="조치와 결과">
          {c.resolution.items.length ? (
            <Table head={["기록", "조치", "결과"]}>
              {c.resolution.items.map((x) => <tr key={x.ref}><td className="font-mono text-xs">{x.ref}</td><td>{x.title}</td><td className="text-ink-muted">{x.summary ?? "-"}</td></tr>)}
            </Table>
          ) : <Empty>{c.meta.status === "resolved" ? EMPTY.resolutionUnmarked : EMPTY.resolution}</Empty>}
          {c.resolution.resolve_note && <p className="mt-2"><b>완료 사유</b> {c.resolution.resolve_note}</p>}
          {c.resolution.others.length > 0 && <p className="mt-2 text-ink-muted"><b className="text-ink">그 밖의 조치·참고</b> {c.resolution.others.map((o) => `${o.ref} ${o.title}`).join(" · ")}</p>}
          {c.resolution.note && <p className="mt-2"><Sentences s={[c.resolution.note]} inline to={to} /></p>}
        </Sec>

        <Sec n="6" title="추가로 드러난 문제">
          {c.side_issues.length ? (
            <ul className="flex flex-col gap-1">{c.side_issues.map((x) => <li key={x.ref}><b><Ref r={x.ref} /> {x.title}</b>{x.note && <> — <Sentences s={[x.note]} inline to={to} /></>}</li>)}</ul>
          ) : <Empty>{EMPTY.side}</Empty>}
        </Sec>

        <Sec n="7" title="규정 관련">
          {c.policy.length ? (
            <Table head={["관계", "문서", "조문", "기록", "메모"]}>
              {groupPolicy(c.policy).map((p, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap">{relationText[p.relation]}</td><td>{p.document ?? "-"}</td><td>{p.article ?? "-"}</td>
                  <td className="font-mono text-xs">{p.refs.join(" ")}</td>
                  <td className="text-ink-muted">{p.notes.map((n) => <div key={n}>{n}</div>)}</td>
                </tr>
              ))}
            </Table>
          ) : <Empty>{EMPTY.policy}</Empty>}
        </Sec>

        <Sec n="8" title="재발 방지·후속 조치" tag={c.prevention.length > 0 && (c.prevention_refs?.length ? <TeamTag /> : <AiTag />)}>
          {c.prevention.length ? (
            <Table head={["조치", "근거", "담당", "기한"]}>
              {c.prevention.map((p, i) => <tr key={i}><td>{p.text}</td><td><Refs refs={p.refs} to={to} /></td><td>{p.owner ?? ""}</td><td>{p.due ?? ""}</td></tr>)}
            </Table>
          ) : <Empty>{aiEmpty(ai)}</Empty>}
        </Sec>

        <Sec n="9" title="남은 확인 사항">{c.open_items.length ? <Sentences s={c.open_items} to={to} /> : <Empty>{EMPTY.open}</Empty>}</Sec>

        <Sec title="부록 — 근거 기록">
          <Table head={["번호", "구분", "제목", "일시", ...(internal ? ["작성자"] : [])]}>
            {c.records.map((r) => (
              <tr key={r.ref}>
                <td className="font-mono text-xs">{r.ref}</td><td className="whitespace-nowrap">{kindLabel[r.kind]}</td><td>{r.title}</td>
                <td className="whitespace-nowrap tabular-nums">{fmtDateTime(r.at)}</td>{internal && <td className="whitespace-nowrap text-ink-muted">{r.author}</td>}
              </tr>
            ))}
          </Table>
        </Sec>
      </article>
    </main>
  );
}

const metaWrite = (ai: AiState, at: string | null) =>
  ai === "done" ? `AI 초안 · ${fmtDateTime(at)}` : ai === "writing" ? "AI 작성 중" : ai === "failed" ? "사실 칸만 (AI 실패)" : "사실 칸만 (AI 꺼짐)";

function Notice({ tone, children }: { tone?: "warn" | "fail"; children: React.ReactNode }) {
  return (
    <p className={cn("flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink", tone === "fail" ? "bg-fail-bg" : tone === "warn" ? "bg-warn-bg/60" : "bg-primary-50")}>{children}</p>
  );
}
// 재발 방지 칸: 팀이 표시한 기록이면 "무엇을 실을지"는 사람이 골랐고 문장만 AI 가 다듬는다 — AI 가 고른 경우와 구분한다(#128)
function TeamTag() {
  return <span className="rounded bg-success-bg px-1.5 py-0.5 text-xs font-normal text-success print:ring-1 print:ring-border" title="타임라인에서 '재발 방지로 표시'한 기록입니다. 문장은 AI 가 기록을 바탕으로 다듬었습니다">팀이 표시한 기록</span>;
}
function AiTag({ inline }: { inline?: boolean }) {
  return <span className={cn("rounded bg-primary-50 px-1.5 py-0.5 text-xs font-normal text-primary-700 print:ring-1 print:ring-border", inline && "ml-1")}>AI 작성 — 원문 확인</span>;
}

function Meta({ k, v }: { k: string; v: string }) {
  return <div className="min-w-0"><dt className="text-ink-muted">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>;
}
function Sec({ n, title, tag, children }: { n?: string; title: string; tag?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="mb-2 flex flex-wrap items-center gap-2 border-b border-border pb-1 text-base font-bold">{n && `${n}. `}{title}{tag}</h2>
      {children}
    </section>
  );
}
function Empty({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  const Tag = inline ? "span" : "p";
  return <Tag className="text-ink-muted italic">{children}</Tag>;
}
function Ref({ r }: { r: string }) {
  return <span className="font-mono text-xs text-primary-700">{r}</span>;
}
// 근거 번호는 원 기록(타임라인)으로 가는 링크 — 인쇄에서는 글자만
function Refs({ refs, to }: { refs: string[]; to?: (r: string) => string | null }) {
  return <>{refs.map((r) => { const href = to?.(r); return href
    ? <Link key={r} href={href} className="font-mono text-xs text-primary-700 underline-offset-2 hover:underline print:no-underline">[{r}]</Link>
    : <span key={r} className="font-mono text-xs text-primary-700">[{r}]</span>; })}</>;
}
function Sentences({ s, inline, to }: { s: ReportSentence[]; inline?: boolean; to?: (r: string) => string | null }) {
  const body = s.map((x, i) => <span key={i}>{x.text} <Refs refs={x.refs} to={to} /> </span>);
  return inline ? <>{body}</> : <p>{body}</p>;
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[32.5rem] text-left text-sm print:min-w-0 [&_td]:border-t [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top">
        <thead><tr className="text-xs text-ink-muted">{head.map((h) => <th key={h} className="whitespace-nowrap px-2 py-1 font-medium">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
