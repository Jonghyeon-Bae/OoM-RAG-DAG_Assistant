// 장애 보고서 템플릿 R1 계약 (FE-REQ-005 §4, 2026-11-13 확정). 서버 응답 content 와 같은 모양.
// 출처: 백엔드 /reports (2026-11-18 회신, PR #51). 사실 칸은 서버가 DB 로, AI 문장 칸은 워커가 채운다.

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
  // ↓ AI 칸 — generating·failed 이거나 서버 AI 꺼짐이면 빈 배열. open_items 는 서버 사실 칸
  summary: ReportSentence[];
  impact: ReportSentence[];
  prevention: (ReportSentence & { owner?: string | null; due?: string | null })[];
  open_items: ReportSentence[];
  prevention_refs?: string[]; // 팀이 "재발 방지"로 표시한 기록 번호 — 표시가 있을 때만 온다(백엔드 #58). 있으면 prevention 은 AI 가 고른 것이 아니라 표시한 기록이다
  records: { ref: string; id: number; kind: ReportKind; title: string; at: string; author: string | null }[];
}

// 서버 보고서 (GET /reports?root_id= · POST /reports). id 는 다시 만들면 바뀐다 — 주소·저장소에 넣지 않는다(회신 §3.7 ③)
export interface Report {
  id: number; root_id: number; status: "generating" | "done" | "failed"; audience: ReportAudience;
  // 지금 보여 주는 보고서보다 새 요청의 상태 — 목록에서만 값, POST·한 건 조회는 늘 null (§3.5)
  pending_status: "generating" | "failed" | null;
  template_version: "R1"; prompt_version: string | null; model: string | null;
  generated_at: string | null; // UTC. 만드는 중이면 null
  error: string | null;        // 서버 내부 오류 원문 — 화면에 보이지 않는다(§6)
  stale: boolean; content: ReportContent;
}
