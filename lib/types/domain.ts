// 04 과제정의서 §3·§4 기준. Flyway V1 / OpenAPI 확정 시 생성본으로 교체.
export type LogType = "fail" | "success" | "ref";
export type LogStatus = "active" | "deprecated";
export type RefineStatus = "pending" | "processing" | "done" | "failed";

export interface Workspace {
  id: number;
  name: string;
  policy_enabled: boolean;
}

export interface User {
  id: number;
  name: string;
  title: string; // TODO:04 users.title 없음 (쟁점 8)
  workspace_id: number;
}

export interface LogNode {
  id: number;
  workspace_id: number;
  type: LogType;
  status: LogStatus;
  title: string;
  body: string;
  author_name: string;
  path_label: string; // 프론트 계산 가능. 목업은 값 보유
  error_code: string | null;
  keywords: string[];
  resolution_summary: string | null;
  refine_status: RefineStatus;
  last_confirmed_at: string | null;
  deprecated_via: number | null; // 상위 폐기에 따라 함께 폐기된 경우 그 상위 id (복원 연동용)
  resolved_at: string | null; // 루트(장애 건) 완료 시각. 루트에만 의미 (TODO:04 쟁점 10)
  resolve_note: string | null; // 성공 로그 없이 완료할 때 필수 사유 (UX-003 D1)
  deprecate_reason: string | null; // 폐기 사유. 연쇄 폐기된 하위에도 같은 사유 (UX-003 D3)
  root_id: number; // 소속 장애 건의 루트 노드 id (서버 계산)
  created_at: string;
}

export interface LogCounts {
  all: number;
  fail: number;
  success: number;
  ref: number;
} // TODO:04 GET /api/logs 응답에 counts 없음 (쟁점 2)

export interface ChainNode {
  id: number;
  type: LogType;
  status: LogStatus;
  title: string;
  depth: number; // 음수 = 조상, 0 = 진입, 양수 = 자손
  path_label: string;
  note: string | null; // 발생 횟수·적용 결과 등 부가 문구
  last_confirmed_at: string | null;
}

export interface Chain {
  entry_id: number;
  nodes: ChainNode[];
  edges: { parent_id: number; child_id: number }[];
  summary: string | null;
}

export interface PolicyRef {
  ref: string; chunk_id: string; doc_id: number; doc_title: string; version: string;
  article_label: string; page: number; text: string;
}

// ── SSE 이벤트 (04 §4.3). Pydantic → gen_sse_types.py 생성본이 생기면 교체 ──
export type Intent = "policy" | "troubleshoot" | "both";
export type Mode = "policy" | "dag_only";
export type StageNode = "supervisor" | "policy_rag" | "graph_search" | "gate" | "generate" | "critic";
export type StageStatus = "start" | "done" | "error";

export interface ChainEventNode {
  ref: string; id: number; type: LogType; status: LogStatus; title: string;
  depth: number; path_label: string; last_confirmed_at: string | null;
}
export interface ChainEvent { entry_id: number; nodes: ChainEventNode[]; edges: { parent_id: number; child_id: number }[] }
export interface CitationsEvent { verified: string[]; unverified: string[] }
export interface DoneEvent {
  intent: Intent; retrieved_ids: string[]; verified_ids: string[]; unverified_ids: string[];
  latency: { retrieval_ms: number; first_token_ms: number; total_ms: number };
  model: string; prompt_tokens: number; completion_tokens: number;
}

export type ChatEvent =
  | { event: "session"; data: { session_id: number } }
  | { event: "stage"; data: { node: StageNode; status: StageStatus; detail?: string } }
  | { event: "intent"; data: { intent: Intent; mode: Mode } }
  | { event: "policy"; data: PolicyRef[] }
  | { event: "chain"; data: ChainEvent }
  | { event: "token"; data: { text: string } }
  | { event: "citations"; data: CitationsEvent }
  | { event: "done"; data: DoneEvent }
  | { event: "error"; data: { message: string; node?: StageNode } };

export interface DashboardSummary {
  is_sample: boolean; // true면 "예시 데이터" 라벨
  search_time: {
    before_min: number;
    after_min: number;
    by_intent: { intent: Intent; before_min: number; after_min: number }[];
  };
  eval: { faithfulness: number | null; answer_relevance: number | null; dataset_version: string | null; run_at: string | null };
  logs: { total: number; week: number; open_roots: number; resolved_roots: number; refine_failed: number };
  feedback: { up: number; down: number };
  latency_ms: { retrieval: number | null; first_token: number | null; total: number | null };
}

export type DocStatus = "active" | "retired";
export type SourceType = "pdf" | "hwp" | "markdown" | "json";

export interface PolicyDocument {
  id: number;
  workspace_id: number;
  slug: string;
  title: string;
  version: string;
  source_type: SourceType; // TODO:04 (BE-REQ-001 S7)
  has_file: boolean;
  status: DocStatus;
  retired_at: string | null;
  retire_reason: string | null;
  visibility: "company" | "dept"; // TODO:04 (S5)
  chunk_count: number;
  indexed_at: string;
  uploaded_by: string; // 적재 실행자(스크립트 실행 계정 또는 1.1 업로드 UI 사용자)
  uploaded_at: string;
  approved_by: string | null; // 1.1 검수 승인자. 1.0은 NULL
  retired_by: string | null;
}

export type DocEventAction = "uploaded" | "indexed" | "superseded" | "retired" | "restored" | "deleted";
export interface DocEvent {
  id: number;
  workspace_id: number;
  document_id: number;
  document_label: string; // "제목 vX" — 삭제된 문서의 이력도 읽히도록 비정규화
  action: DocEventAction;
  actor: string;
  source: "script" | "ui";
  reason: string | null;
  at: string;
}

export interface PolicyChunk {
  id: string; // "{slug}-a{조항}-{seq}"
  article_label: string;
  page: number | null;
  text: string;
}
