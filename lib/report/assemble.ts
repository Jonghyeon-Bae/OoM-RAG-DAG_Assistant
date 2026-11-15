import type { Chain, LogNode } from "@/lib/types/domain";
import type { ReportAudience, ReportContent, ReportKind, ReportSentence } from "@/lib/types/report";

// 장애 보고서 R1 — 사실 칸 조립 (FE-REQ-005 §1·§2). 백엔드 보고서 API 가 생기기 전의 임시 출처(#114).
// 규칙은 계약과 같다: 근거 = 루트 + 하위 중 활성 기록, 번호 N1… = 기록 시각 오름차순(같으면 id), 구분은 DB 값으로만 정한다.
// AI 문장 칸(summary·impact·설명·prevention·open_items)은 비워 두고 화면이 고정 문구를 보여 준다.
// 백엔드 R-1~R-3 이 생기면 이 파일 대신 GET /reports/{id} 의 content 를 쓴다 — 화면(ReportView)은 그대로.

const kindOf = (n: { id: number; type: string; is_cause: boolean; resolves_root: boolean }, rootId: number): ReportKind =>
  n.id === rootId ? "occurrence" : n.is_cause ? "cause" : n.resolves_root ? "resolution" : n.type === "success" ? "action" : n.type === "fail" ? "side_issue" : "reference";

// 제목 앞 "원인:"·"해결:" 머리는 섹션·구분 칸이 이미 말하므로 뗀다(백엔드 _action() 과 같은 규칙)
const clean = (t: string) => t.replace(/^(원인|해결\(구\)|해결|참고)\s*:\s*/, "");

export function assembleReport({ chain, logs, rootId, workspaceName, audience }: {
  chain: Chain; logs: LogNode[]; rootId: number; workspaceName: string; audience: ReportAudience;
}): ReportContent | null {
  const byId = new Map(logs.map((l) => [l.id, l]));
  const root = byId.get(rootId);
  if (!root) return null;
  const internal = audience === "internal";

  // 근거 기록: 체인(루트 기준)에 든 활성 기록 + 로그 상세. 번호는 시각순
  const nodes = chain.nodes
    .filter((n) => n.status === "active" || n.id === rootId)
    .map((n) => ({ n, l: byId.get(n.id) }))
    .filter((x): x is { n: (typeof chain.nodes)[number]; l: LogNode } => !!x.l)
    .sort((a, b) => a.l.created_at.localeCompare(b.l.created_at) || a.n.id - b.n.id);
  const refOf = new Map(nodes.map((x, i) => [x.n.id, `N${i + 1}`]));
  const reasonOf = (id: number) => chain.edges.find((e) => e.child_id === id && e.reason)?.reason ?? null;
  const rows = nodes.map(({ n, l }) => ({ n, l: { ...l, title: n.id === rootId ? l.title : clean(l.title) }, ref: refOf.get(n.id)!, kind: kindOf(n, rootId) }));

  const resolved = root.resolved_at;
  const status = root.type === "ref" ? "reference" : resolved ? "resolved" : "open";
  const duration = resolved ? Math.max(0, Math.round((Date.parse(resolved) - Date.parse(root.created_at)) / 60000)) : null;

  return {
    meta: {
      title: root.title, interim: status === "open", workspace_name: workspaceName, status, root_id: rootId,
      first_reported_at: root.created_at, resolved_at: resolved, duration_minutes: duration,
      record_count: rows.length, truncated: chain.truncated,
    },
    occurrence: {
      symptom: root.body.length > 200 ? `${root.body.slice(0, 200)}…` : root.body,
      error_codes: [...new Set(rows.map((r) => r.l.error_code).filter((c): c is string => !!c))],
      reported_at: root.created_at,
      reported_by: internal ? root.author_name : null,
    },
    timeline: rows.map((r) => ({ ref: r.ref, at: r.l.created_at, kind: r.kind, title: r.l.title, author: internal ? r.l.author_name : null })),
    causes: rows.filter((r) => r.kind === "cause").map((r) => ({ ref: r.ref, title: r.l.title, link_reason: reasonOf(r.n.id), explanation: null })),
    resolution: {
      items: rows.filter((r) => r.kind === "resolution").map((r) => ({ ref: r.ref, title: r.l.title, summary: r.l.resolution_summary ?? r.n.note })),
      resolve_note: root.resolve_note,
      others: rows.filter((r) => r.kind === "action" || r.kind === "reference").map((r) => ({ ref: r.ref, kind: r.kind, title: r.l.title })),
      note: null,
    },
    side_issues: rows.filter((r) => r.kind === "side_issue").map((r) => ({ ref: r.ref, title: r.l.title, note: null })),
    policy: rows.flatMap((r) => (r.n.policy_refs ?? []).map((p) => ({
      ref: r.ref, relation: p.relation, document: p.doc_title ?? p.policy, article: p.article_label ?? p.article, note: p.note ?? (p.relation === "gap" ? p.topic : null),
    }))),
    summary: [], impact: [], prevention: [], open_items: [],
    records: rows.map((r) => ({ ref: r.ref, id: r.n.id, kind: r.kind, title: r.l.title, at: r.l.created_at, author: internal ? r.l.author_name : null })),
  };
}

// ── 표기 ──
export const kindLabel: Record<ReportKind, string> = { occurrence: "발생", cause: "원인", resolution: "해결", action: "조치", side_issue: "추가 문제", reference: "참고" };
export const relationText = { follows: "규정 따름", exception: "규정 예외", gap: "규정 없음" } as const;
// R1 §2 비었을 때 고정 문구
export const EMPTY = {
  summary: "AI 요약 — 백엔드 보고서 생성 연결 후 작성됩니다(FE-REQ-005)",
  impact: "기록에 영향 범위가 없습니다 — 담당자 확인 필요",
  causes: "원인으로 표시된 기록이 없습니다",
  resolution: "해결 기록이 없습니다(진행 중)",
  resolutionUnmarked: "완료됐지만 \u201c해결한 기록\u201d으로 표시된 기록이 없습니다 — 완료 처리 때 해결 기록을 고르지 않았음. 아래 \u201c그 밖의 조치\u201d 참고",
  side: "없음",
  policy: "근거 조문이 남은 기록이 없습니다",
  prevention: "기록에 후속 조치가 없습니다 — 담당자 작성 필요",
  open: "없음",
  aiPending: "AI 설명 — 백엔드 연결 후 작성",
} as const;

export const fmtDateTime = (iso: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};
export const fmtShort = (iso: string) => fmtDateTime(iso).slice(5);
export function fmtDuration(min: number | null, from?: string) {
  if (min == null) {
    if (!from) return "-";
    const days = Math.floor((Date.now() - Date.parse(from)) / 86400000);
    return `진행 중(경과 ${days}일)`;
  }
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  return [d && `${d}일`, h && `${h}시간`, (m || (!d && !h)) && `${m}분`].filter(Boolean).join(" ");
}
// 규정 표: 같은 관계·문서·조문은 한 줄로(기록 번호를 모음). 계약 데이터는 기록마다 한 줄 그대로 두고 화면·Markdown 에서만 묶는다
export function groupPolicy(rows: ReportContent["policy"]) {
  const m = new Map<string, { refs: string[]; relation: ReportContent["policy"][number]["relation"]; document: string | null; article: string | null; notes: string[] }>();
  for (const p of rows) {
    const k = `${p.relation}|${p.document ?? ""}|${p.article ?? ""}`;
    const g = m.get(k) ?? { refs: [], relation: p.relation, document: p.document, article: p.article, notes: [] };
    if (!g.refs.includes(p.ref)) g.refs.push(p.ref);
    if (p.note) g.notes.push(`${p.ref} ${p.note}`);
    m.set(k, g);
  }
  return [...m.values()];
}
const cite = (s: ReportSentence) => `${s.text} ${s.refs.map((r) => `[${r}]`).join("")}`;

// Markdown 복사용 — 화면과 같은 R1 순서·제목
export function reportMarkdown(c: ReportContent, audience: ReportAudience): string {
  const L: string[] = [];
  const head = c.meta.interim ? "[장애 중간 보고서]" : "[장애 보고서]";
  L.push(`# ${head} ${c.meta.title}`, "");
  L.push("| 부서 | 장애 건 | 상태 | 최초 기록 | 완료 | 소요 | 근거 기록 | 공개 |", "|---|---|---|---|---|---|---|---|");
  L.push(`| ${c.meta.workspace_name} | #${c.meta.root_id} | ${c.meta.status === "resolved" ? "완료" : c.meta.status === "open" ? "진행 중" : "참고"} | ${fmtDateTime(c.meta.first_reported_at)} | ${fmtDateTime(c.meta.resolved_at)} | ${fmtDuration(c.meta.duration_minutes, c.meta.first_reported_at)} | ${c.meta.record_count}건 | ${audience === "internal" ? "내부" : "외부"} |`, "");
  L.push("> AI 초안 — 검토자 확인 전", "");
  L.push("## 1. 한눈에 보기", c.summary.length ? c.summary.map(cite).join(" ") : EMPTY.summary, "");
  L.push("## 2. 발생 현황", `- 최초 증상: ${c.occurrence.symptom}`, `- 오류 코드: ${c.occurrence.error_codes.join(", ") || "-"} · 최초 기록: ${fmtDateTime(c.occurrence.reported_at)}${c.occurrence.reported_by ? ` (${c.occurrence.reported_by})` : ""}`, `- 영향: ${c.impact.length ? c.impact.map(cite).join(" ") : EMPTY.impact}`, "");
  L.push("## 3. 경과", `| 일시 | 구분 | 내용 | 기록 |${audience === "internal" ? " 작성자 |" : ""}`, `|---|---|---|---|${audience === "internal" ? "---|" : ""}`);
  c.timeline.forEach((t) => L.push(`| ${fmtShort(t.at)} | ${kindLabel[t.kind]} | ${t.title} | ${t.ref} |${audience === "internal" ? ` ${t.author ?? ""} |` : ""}`));
  L.push("", "## 4. 원인");
  if (!c.causes.length) L.push(EMPTY.causes);
  c.causes.forEach((x) => L.push(`- **${x.ref} ${x.title}** — ${x.explanation ? cite(x.explanation) : EMPTY.aiPending}${x.link_reason ? ` (연결 이유: ${x.link_reason})` : ""}`));
  L.push("", "## 5. 조치와 결과");
  if (!c.resolution.items.length) L.push(c.meta.status === "resolved" ? EMPTY.resolutionUnmarked : EMPTY.resolution);
  else { L.push("| 기록 | 조치 | 결과 |", "|---|---|---|"); c.resolution.items.forEach((x) => L.push(`| ${x.ref} | ${x.title} | ${x.summary ?? "-"} |`)); }
  if (c.resolution.resolve_note) L.push(`- 완료 사유: ${c.resolution.resolve_note}`);
  if (c.resolution.others.length) L.push(`- 그 밖의 조치·참고: ${c.resolution.others.map((o) => `${o.ref} ${o.title}`).join(" · ")}`);
  L.push("", "## 6. 추가로 드러난 문제");
  if (!c.side_issues.length) L.push(EMPTY.side);
  c.side_issues.forEach((x) => L.push(`- **${x.ref} ${x.title}**${x.note ? ` — ${cite(x.note)}` : ""}`));
  L.push("", "## 7. 규정 관련");
  if (!c.policy.length) L.push(EMPTY.policy);
  else { L.push("| 관계 | 문서 | 조문 | 기록 | 메모 |", "|---|---|---|---|---|"); groupPolicy(c.policy).forEach((p) => L.push(`| ${relationText[p.relation]} | ${p.document ?? "-"} | ${p.article ?? "-"} | ${p.refs.join(" ")} | ${p.notes.join(" / ")} |`)); }
  L.push("", "## 8. 재발 방지·후속 조치");
  if (!c.prevention.length) L.push(EMPTY.prevention);
  else { L.push("| 조치 | 근거 | 담당 | 기한 |", "|---|---|---|---|"); c.prevention.forEach((p) => L.push(`| ${p.text} | ${p.refs.join(" ")} | ${p.owner ?? ""} | ${p.due ?? ""} |`)); }
  L.push("", "## 9. 남은 확인 사항", c.open_items.length ? c.open_items.map((o) => `- ${cite(o)}`).join("\n") : EMPTY.open, "");
  L.push("## 부록 — 근거 기록", `| 번호 | 구분 | 제목 | 일시 |${audience === "internal" ? " 작성자 |" : ""}`, `|---|---|---|---|${audience === "internal" ? "---|" : ""}`);
  c.records.forEach((r) => L.push(`| ${r.ref} | ${kindLabel[r.kind]} | ${r.title} | ${fmtDateTime(r.at)} |${audience === "internal" ? ` ${r.author ?? ""} |` : ""}`));
  return L.join("\n");
}
