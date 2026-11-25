import type { ReportAudience, ReportContent, ReportKind, ReportSentence } from "@/lib/types/report";
import type { Report } from "@/lib/types/report";
import { fmtKst } from "@/lib/datetime";

// 장애 보고서 R1 — 표기·Markdown (FE-REQ-005). 내용은 서버 /reports 의 content 를 그대로 쓴다(#118).
// #114 의 화면 쪽 조립(assembleReport)은 서버가 같은 규칙으로 조립하게 되어 지웠다 — 규정 표 묶기만 화면에서 한다(회신 §3.4).

// AI 칸의 상태 — 빈 칸 문구를 고른다(회신 §3.7 ④). off = 서버 AI 꺼짐 또는 키 없음(done 인데 prompt_version 없음)
export type AiState = "writing" | "done" | "failed" | "off";
export const aiStateOf = (r: Pick<Report, "status" | "prompt_version">): AiState =>
  r.status === "generating" ? "writing" : r.status === "failed" ? "failed" : r.prompt_version == null ? "off" : "done";
const AI_EMPTY: Record<AiState, string> = {
  writing: "AI 작성 중…",
  done: "해당 기록 없음",
  failed: "AI 문장을 만들지 못했습니다",
  off: "AI 문장 없음 — 서버에서 AI 작성이 꺼져 있습니다",
};
// summary·impact·prevention 이 비었을 때. done 이면 "해당 기록 없음"(AI 가 지어내지 않고 비운 것 — 실패 아님)
export const aiEmpty = (s: AiState) => AI_EMPTY[s];

// ── 표기 ──
export const kindLabel: Record<ReportKind, string> = { occurrence: "발생", cause: "원인", resolution: "해결", action: "조치", side_issue: "추가 문제", reference: "참고" };
export const relationText = { follows: "규정 따름", exception: "규정 예외", gap: "규정 없음" } as const;
// "조치와 결과"가 비었을 때: 진행 중 / 완료 사유로 마무리 / 완료인데 해결 기록도 사유도 없음
export const resolutionEmpty = (c: ReportContent) => (c.meta.status !== "resolved" ? EMPTY.resolution : c.resolution.resolve_note ? EMPTY.resolutionByNote : EMPTY.resolutionUnmarked);
// 사실 칸이 비었을 때 고정 문구 (R1 §2)
export const EMPTY = {
  causes: "원인으로 표시된 기록이 없습니다",
  resolution: "해결 기록이 없습니다(진행 중)",
  resolutionUnmarked: "완료됐지만 \u201c해결한 기록\u201d으로 표시된 기록이 없습니다 — 완료 처리 때 해결 기록을 고르지 않았음. 아래 \u201c그 밖의 조치\u201d 참고",
  resolutionByNote: "해결 기록 대신 완료 사유로 남긴 건입니다", // 메모로 완료(해결 기록 없음) — 백엔드 #74 로 메모가 저장된다
  side: "없음",
  policy: "근거 조문이 남은 기록이 없습니다",
  open: "남은 확인 없음", // open_items 는 서버 사실 칸 — 비면 남은 것이 없다는 뜻
} as const;

export const fmtDateTime = (iso: string | null) => fmtKst(iso, "YYYY-MM-DD HH:mm");
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
export function reportMarkdown(c: ReportContent, audience: ReportAudience, ai: AiState): string {
  const L: string[] = [];
  const head = c.meta.interim ? "[장애 중간 보고서]" : "[장애 보고서]";
  L.push(`# ${head} ${c.meta.title}`, "");
  L.push("| 부서 | 장애 건 | 상태 | 최초 기록 | 완료 | 소요 | 근거 기록 | 공개 |", "|---|---|---|---|---|---|---|---|");
  L.push(`| ${c.meta.workspace_name} | #${c.meta.root_id} | ${c.meta.status === "resolved" ? "완료" : c.meta.status === "open" ? "진행 중" : "참고"} | ${fmtDateTime(c.meta.first_reported_at)} | ${fmtDateTime(c.meta.resolved_at)} | ${fmtDuration(c.meta.duration_minutes, c.meta.first_reported_at)} | ${c.meta.record_count}건 | ${audience === "internal" ? "내부" : "외부"} |`, "");
  L.push("> AI 작성 칸(한눈에 보기·영향·원인 설명·조치 메모·재발 방지)은 초안 — 근거 번호의 원 기록을 확인하세요", "");
  L.push("## 1. 한눈에 보기", c.summary.length ? c.summary.map(cite).join(" ") : aiEmpty(ai), "");
  L.push("## 2. 발생 현황", `- 최초 증상: ${c.occurrence.symptom}`, `- 오류 코드: ${c.occurrence.error_codes.join(", ") || "-"} · 최초 기록: ${fmtDateTime(c.occurrence.reported_at)}${c.occurrence.reported_by ? ` (${c.occurrence.reported_by})` : ""}`, `- 영향: ${c.impact.length ? c.impact.map(cite).join(" ") : aiEmpty(ai)}`, "");
  L.push("## 3. 경과", `| 일시 | 구분 | 내용 | 기록 |${audience === "internal" ? " 작성자 |" : ""}`, `|---|---|---|---|${audience === "internal" ? "---|" : ""}`);
  c.timeline.forEach((t) => L.push(`| ${fmtShort(t.at)} | ${kindLabel[t.kind]} | ${t.title} | ${t.ref} |${audience === "internal" ? ` ${t.author ?? ""} |` : ""}`));
  L.push("", "## 4. 원인");
  if (!c.causes.length) L.push(EMPTY.causes);
  c.causes.forEach((x) => L.push(`- **${x.ref} ${x.title}** — ${x.explanation ? cite(x.explanation) : ai === "writing" ? aiEmpty(ai) : "-"}${x.link_reason ? ` (연결 이유: ${x.link_reason})` : ""}`));
  L.push("", "## 5. 조치와 결과");
  if (!c.resolution.items.length) L.push(resolutionEmpty(c));
  else { L.push("| 기록 | 조치 | 결과 |", "|---|---|---|"); c.resolution.items.forEach((x) => L.push(`| ${x.ref} | ${x.title} | ${x.summary ?? "-"} |`)); }
  if (c.resolution.resolve_note) L.push(`- 완료 사유: ${c.resolution.resolve_note}`);
  if (c.resolution.others.length) L.push(`- 그 밖의 조치·참고: ${c.resolution.others.map((o) => `${o.ref} ${o.title}`).join(" · ")}`);
  if (c.resolution.note) L.push(`- ${cite(c.resolution.note)}`);
  L.push("", "## 6. 추가로 드러난 문제");
  if (!c.side_issues.length) L.push(EMPTY.side);
  c.side_issues.forEach((x) => L.push(`- **${x.ref} ${x.title}**${x.note ? ` — ${cite(x.note)}` : ""}`));
  L.push("", "## 7. 규정 관련");
  if (!c.policy.length) L.push(EMPTY.policy);
  else { L.push("| 관계 | 문서 | 조문 | 기록 | 메모 |", "|---|---|---|---|---|"); groupPolicy(c.policy).forEach((p) => L.push(`| ${relationText[p.relation]} | ${p.document ?? "-"} | ${p.article ?? "-"} | ${p.refs.join(" ")} | ${p.notes.join(" / ")} |`)); }
  L.push("", "## 8. 재발 방지·후속 조치");
  if (!c.prevention.length) L.push(aiEmpty(ai));
  else { L.push("| 조치 | 근거 | 담당 | 기한 |", "|---|---|---|---|"); c.prevention.forEach((p) => L.push(`| ${p.text} | ${p.refs.join(" ")} | ${p.owner ?? ""} | ${p.due ?? ""} |`)); }
  L.push("", "## 9. 남은 확인 사항", c.open_items.length ? c.open_items.map((o) => `- ${cite(o)}`).join("\n") : EMPTY.open, "");
  L.push("## 부록 — 근거 기록", `| 번호 | 구분 | 제목 | 일시 |${audience === "internal" ? " 작성자 |" : ""}`, `|---|---|---|---|${audience === "internal" ? "---|" : ""}`);
  c.records.forEach((r) => L.push(`| ${r.ref} | ${kindLabel[r.kind]} | ${r.title} | ${fmtDateTime(r.at)} |${audience === "internal" ? ` ${r.author ?? ""} |` : ""}`));
  return L.join("\n");
}
