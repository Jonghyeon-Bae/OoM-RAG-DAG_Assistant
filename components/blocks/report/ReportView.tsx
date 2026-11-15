"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Chip, cn } from "@/components/ui";
import { assembleReport, groupPolicy, EMPTY, fmtDateTime, fmtDuration, fmtShort, kindLabel, relationText, reportMarkdown } from "@/lib/report/assemble";
import type { Chain, LogNode } from "@/lib/types/domain";
import type { ReportAudience, ReportKind, ReportSentence } from "@/lib/types/report";

// 장애 보고서 R1 화면 (FE-REQ-005 확정 템플릿, #114). 섹션 순서·제목은 고정이고 비어도 지우지 않는다.
// 지금 사실 칸은 체인·로그로 조립, AI 문장 칸은 백엔드 연결 전이라 고정 안내 문구. 인쇄 → PDF 저장은 브라우저 인쇄로.
const kindTone: Record<ReportKind, "fail" | "primary" | "neutral" | "warn" | "dark"> = { occurrence: "fail", cause: "fail", resolution: "primary", action: "neutral", side_issue: "warn", reference: "neutral" };

export function ReportView({ wsId, rootId, chain, logs, workspaceName, canExternal }: {
  wsId: number; rootId: number; chain: Chain; logs: LogNode[]; workspaceName: string; canExternal: boolean;
}) {
  const [audience, setAudience] = useState<ReportAudience>("internal");
  const [copied, setCopied] = useState(false);
  const c = useMemo(() => assembleReport({ chain, logs, rootId, workspaceName, audience }), [chain, logs, rootId, workspaceName, audience]);
  if (!c) return <main className="p-6 text-sm text-ink-muted">장애 건을 찾을 수 없습니다.</main>;
  const internal = audience === "internal";
  const copy = async () => { await navigator.clipboard?.writeText(reportMarkdown(c, audience)); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <main className="flex flex-col gap-4 p-3 md:p-6 xl:p-8 print:p-0">
      {/* 도구 줄 — 인쇄에는 나오지 않는다 */}
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Link href={`/w/${wsId}/timeline?entry=${rootId}`} className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-sm text-ink hover:bg-primary-50 pointer-coarse:min-h-11"><ArrowLeft className="size-4" /> 타임라인</Link>
        <div role="radiogroup" aria-label="공개 수준" className="flex rounded-lg bg-primary-50 p-0.5">
          {(["internal", "external"] as const).map((a) => (
            <button key={a} type="button" role="radio" aria-checked={audience === a} disabled={a === "external" && !canExternal}
              title={a === "external" && !canExternal ? "외부 공개판은 부서 관리자만 만들 수 있습니다" : undefined}
              onClick={() => setAudience(a)}
              className={cn("h-8 rounded-md px-3 text-sm pointer-coarse:min-h-11 disabled:cursor-not-allowed disabled:opacity-40", audience === a ? "bg-primary-700 font-semibold text-white" : "text-ink-muted")}>
              {a === "internal" ? "내부용" : "외부 공개용"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={copy}><Copy className="size-3.5" /> {copied ? "복사됨" : "Markdown 복사"}</Button>
          <Button size="sm" onClick={() => window.print()}><Printer className="size-3.5" /> 인쇄·PDF</Button>
        </div>
      </div>
      <p className="rounded-lg bg-warn-bg/60 px-3 py-2 text-xs text-ink print:hidden">
        초안 — 사실 칸(경과·원인·조치·규정·근거 기록)은 지금 기록으로 채웠습니다. AI 문장 칸(한눈에 보기·영향·원인 설명·재발 방지·남은 확인)은 백엔드 보고서 생성(FE-REQ-005)이 연결되면 채워집니다.
      </p>

      <article className="mx-auto w-full max-w-4xl rounded-2xl bg-card p-4 text-sm leading-relaxed text-ink shadow-sm ring-1 ring-foreground/10 sm:p-8 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
        {!internal && <div className="mb-3 rounded bg-primary-700 px-3 py-1 text-center text-xs font-semibold text-white">외부 공개용</div>}
        <h1 className="text-xl font-bold leading-snug sm:text-2xl">{c.meta.interim ? "[장애 중간 보고서]" : "[장애 보고서]"} {c.meta.title}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-primary-50 p-3 text-xs sm:grid-cols-4 print:bg-transparent print:ring-1 print:ring-border">
          <Meta k="부서" v={c.meta.workspace_name} />
          <Meta k="장애 건" v={`#${c.meta.root_id}`} />
          <Meta k="상태" v={c.meta.status === "resolved" ? "완료" : c.meta.status === "open" ? "진행 중" : "참고"} />
          <Meta k="소요" v={fmtDuration(c.meta.duration_minutes, c.meta.first_reported_at)} />
          <Meta k="최초 기록" v={fmtDateTime(c.meta.first_reported_at)} />
          <Meta k="완료" v={fmtDateTime(c.meta.resolved_at)} />
          <Meta k="근거 기록" v={`${c.meta.record_count}건${c.meta.truncated ? " (일부)" : ""}`} />
          <Meta k="작성" v="AI 초안 — 검토자 확인 전" />
        </dl>

        <Sec n="1" title="한눈에 보기">{c.summary.length ? <Sentences s={c.summary} /> : <Empty>{EMPTY.summary}</Empty>}</Sec>

        <Sec n="2" title="발생 현황">
          <ul className="flex flex-col gap-1">
            <li><b>최초 증상</b> {c.occurrence.symptom}</li>
            <li><b>오류 코드</b> {c.occurrence.error_codes.join(", ") || "-"} · <b>최초 기록</b> {fmtDateTime(c.occurrence.reported_at)}{c.occurrence.reported_by && ` (${c.occurrence.reported_by})`}</li>
            <li><b>영향</b> {c.impact.length ? <Sentences s={c.impact} inline /> : <Empty inline>{EMPTY.impact}</Empty>}</li>
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
                  <div className="text-ink-muted">{x.explanation ? <Sentences s={[x.explanation]} inline /> : <Empty inline>{EMPTY.aiPending}</Empty>}{x.link_reason && <span> · 연결 이유: {x.link_reason}</span>}</div>
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
          {c.resolution.note && <p className="mt-2"><Sentences s={[c.resolution.note]} inline /></p>}
        </Sec>

        <Sec n="6" title="추가로 드러난 문제">
          {c.side_issues.length ? (
            <ul className="flex flex-col gap-1">{c.side_issues.map((x) => <li key={x.ref}><b><Ref r={x.ref} /> {x.title}</b>{x.note && <> — <Sentences s={[x.note]} inline /></>}</li>)}</ul>
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

        <Sec n="8" title="재발 방지·후속 조치">
          {c.prevention.length ? (
            <Table head={["조치", "근거", "담당", "기한"]}>
              {c.prevention.map((p, i) => <tr key={i}><td>{p.text}</td><td className="font-mono text-xs">{p.refs.join(" ")}</td><td>{p.owner ?? ""}</td><td>{p.due ?? ""}</td></tr>)}
            </Table>
          ) : <Empty>{EMPTY.prevention}</Empty>}
        </Sec>

        <Sec n="9" title="남은 확인 사항">{c.open_items.length ? <Sentences s={c.open_items} /> : <Empty>{EMPTY.open}</Empty>}</Sec>

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

function Meta({ k, v }: { k: string; v: string }) {
  return <div className="min-w-0"><dt className="text-ink-muted">{k}</dt><dd className="font-semibold text-ink">{v}</dd></div>;
}
function Sec({ n, title, children }: { n?: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 break-inside-avoid-page">
      <h2 className="mb-2 border-b border-border pb-1 text-base font-bold">{n && `${n}. `}{title}</h2>
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
function Sentences({ s, inline }: { s: ReportSentence[]; inline?: boolean }) {
  const body = s.map((x, i) => <span key={i}>{x.text} {x.refs.map((r) => <span key={r} className="font-mono text-xs text-primary-700">[{r}]</span>)} </span>);
  return inline ? <>{body}</> : <p>{body}</p>;
}
function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto print:overflow-visible">
      <table className="w-full min-w-[520px] text-left text-sm print:min-w-0 [&_td]:border-t [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:align-top">
        <thead><tr className="text-xs text-ink-muted">{head.map((h) => <th key={h} className="whitespace-nowrap px-2 py-1 font-medium">{h}</th>)}</tr></thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
