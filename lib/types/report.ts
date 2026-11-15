// 장애 보고서 템플릿 R1 계약 (FE-REQ-005 §4, 2026-11-13 확정). 서버 응답 content 와 같은 모양.
// 지금은 백엔드 API(R-1~R-3) 전이라 lib/report/assemble.ts 가 사실 칸만 채운다 — AI 문장 칸은 빈 값.

export type ReportAudience = "internal" | "external";
export type ReportKind = "occurrence" | "cause" | "resolution" | "action" | "side_issue" | "reference";
export type ReportStatus = "resolved" | "open" | "reference";
export interface ReportSentence { text: string; refs: string[] } // refs = 근거 기록 번호 N1…

export interface ReportContent {
  meta: {
    title: string; interim: boolean; workspace_name: string; status: ReportStatus; root_id: number;
    first_reported_at: string; resolved_at: string | null; duration_minutes: number | null;
    record_count: number; truncated: boolean;
  };
  occurrence: { symptom: string; error_codes: string[]; reported_at: string; reported_by: string | null };
  timeline: { ref: string; at: string; kind: ReportKind; title: string; author: string | null }[];
  causes: { ref: string; title: string; link_reason: string | null; explanation: ReportSentence | null }[];
  resolution: {
    items: { ref: string; title: string; summary: string | null }[];
    resolve_note: string | null;
    others: { ref: string; kind: ReportKind; title: string }[];
    note: ReportSentence | null;
  };
  side_issues: { ref: string; title: string; note: ReportSentence | null }[];
  policy: { ref: string; relation: "follows" | "exception" | "gap"; document: string | null; article: string | null; note: string | null }[];
  // ↓ LLM 칸 — 백엔드 생성 전에는 빈 배열
  summary: ReportSentence[];
  impact: ReportSentence[];
  prevention: (ReportSentence & { owner?: string | null; due?: string | null })[];
  open_items: ReportSentence[];
  records: { ref: string; id: number; kind: ReportKind; title: string; at: string; author: string | null }[];
}

// 서버 보고서(R-2) — 백엔드가 생기면 이 모양으로 받는다
export interface Report {
  id: number; root_id: number; status: "generating" | "done" | "failed"; audience: ReportAudience;
  template_version: "R1"; prompt_version: string | null; model: string | null; generated_at: string | null;
  error: string | null; stale: boolean; content: ReportContent | null;
}
