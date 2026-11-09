// 04 과제정의서 §3·§4 기준. Flyway V1 / OpenAPI 확정 시 생성본으로 교체.
export type LogType = "fail" | "success" | "ref";
export type LogStatus = "active" | "deprecated";
export type RefineStatus = "pending" | "processing" | "done" | "failed";

// GET /workspaces (WorkspaceController.WorkspaceDto). 규정·사례 두 스위치로 모드가 정해진다(FE-012 §0)
export type WorkspaceKind = "company" | "dept"; // company = 전사 공통(규정만), dept = 부서
export interface Workspace {
  id: number;
  name: string;
  policy_enabled: boolean;
  case_enabled: boolean; // false 면 사례(타임라인·등록) 미사용
  parent_id: number | null; // 부서 → 소속 회사 전사 공통 ws
  kind: WorkspaceKind;
  suggestions: string[]; // 부서별 추천 질문(서버 settings). 비면 추천 칩을 숨긴다
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
  depth: number | null;
  category: "cause" | null; // 장애 건의 원인으로 표시한 기록
  tags: string[];
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
  policy_refs: NodePolicyRef[]; // 이 기록이 근거로 삼은 조문(따름·예외·기준 없음)
  resolves_root: boolean; // 장애 건을 해결한 기록
  is_cause: boolean; // 장애 건의 원인으로 표시한 기록
}

export interface ChainEdge { parent_id: number; child_id: number; reason: string | null } // reason = 이 상위에 이어 붙인 이유

export interface Chain {
  entry_id: number;
  nodes: ChainNode[];
  edges: ChainEdge[];
  summary: string | null;
  total: number;
  truncated: boolean;
}

// 사례 ↔ 규정 조문 관계 (PolicyRefService.RefView). follows 따름 / exception 예외 / gap 기준 없음
export type PolicyRelation = "follows" | "exception" | "gap";
export interface NodePolicyRef {
  relation: PolicyRelation;
  policy: string | null; article: string | null; note: string | null; topic: string | null;
  doc_title: string | null; article_label: string | null;
  revision: string | null; from_label: string | null; // 개정으로 바뀐 조문이면 개정판·이전 표기
  suggested_policy?: string | null; suggested_article?: string | null; suggested_label?: string | null;
}

export interface PolicyRef {
  ref: string; chunk_id: string; doc_id: number; doc_title: string; version: string;
  article_label: string; page: number | null; text: string;
  source?: "search" | "case"; // case = 사례가 근거로 삼은 조문이라 함께 실림
}

// ── SSE 이벤트 (04 §4.3). Pydantic → gen_sse_types.py 생성본이 생기면 교체 ──
export type Intent = "policy" | "troubleshoot" | "both";
export type Mode = "policy" | "dag_only";
export type StageNode = "supervisor" | "policy_rag" | "graph_search" | "gate" | "generate" | "critic";
export type StageStatus = "start" | "done" | "error";

// SSE NodePolicy (sse_events.schema.json): REST RefView 의 축약형
export interface ChainEventPolicy { relation: PolicyRelation; ref?: string | null; label?: string | null; note?: string | null; topic?: string | null; revision?: string | null; from_version?: string | null }
export interface ChainEventNode {
  ref: string; id: number; type: LogType; status: LogStatus; title: string;
  depth: number; path_label: string | null; last_confirmed_at: string | null;
  policy?: ChainEventPolicy[] | null; resolves_root?: boolean; is_cause?: boolean;
}
export interface ChainEvent { entry_id: number; nodes: ChainEventNode[]; edges: ChainEdge[] }
export interface CitationsEvent { verified: string[]; unverified: string[] }
export interface DoneEvent {
  intent: Intent; retrieved_ids: string[]; verified_ids: string[]; unverified_ids: string[];
  latency: { retrieval_ms: number; first_token_ms: number; total_ms: number };
  model: string; prompt_tokens: number; completion_tokens: number;
  truncated?: boolean; // 토큰 한도로 답이 잘렸을 때(백엔드 sse_events.schema)
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

// 검색 내역 1행 = 질문 1건. 답변 본문·근거를 함께 저장해 재검색 없이 다시 본다 (BE-REQ-001 S13)
export interface SearchSession {
  id: number;
  workspace_id: number;
  user_name: string;
  status: "streaming" | "done" | "error"; // 서버 세션 상태(연동확인표 ✏️)
  query: string;
  intent: Intent;
  mode: Mode;
  answer_text: string;
  policy: PolicyRef[];
  chain: ChainEvent | null;
  citations: CitationsEvent;
  latency: DoneEvent["latency"];
  score: 1 | -1 | null; // answer_feedback
  created_at: string;
}

export interface DashboardSummary {
  is_sample: boolean; // true면 "예시 데이터" 라벨
  search_time: {
    before_min: number;
    after_min: number;
    by_intent: { intent: Intent; before_min: number; after_min: number }[];
  } | null;
  eval: { faithfulness: number | null; answer_relevance: number | null; dataset_version: string | null; run_at: string | null };
  logs: { total: number; week: number; open_roots: number; resolved_roots: number; refine_failed: number };
  feedback: { up: number; down: number };
  latency_ms: { retrieval: number | null; first_token: number | null; total: number | null };
  // R-24 2차 (UX-002 1~4). 원천: search_sessions·log_nodes. 모두 서버 집계
  queries: { week: number; total: number; by_intent: { intent: Intent; count: number }[] };
  no_evidence: { rate: number | null; recent: { session_id: number; query: string; intent: Intent; created_at: string }[] }; // 근거 없음 = verified 0건
  resolve_time: { median_hours: number | null; sample: number }; // 완료된 장애 건: created_at → resolved_at
  reused: { node_id: number; title: string; type: LogType; author_name: string; count: number }[]; // 인용 횟수 Top 5
  // 검색 품질 실측(eval/hit_at_k.py --record 최신 행). 측정 전이면 null
  retrieval: {
    hit_at_5: number; n_samples: number; mode: string; mrr: number | null; // hit_at_5 = 비율 0~1
    by_kind: Partial<Record<"policy" | "troubleshoot", { hit: number; n: number }>> | null; // hit = 상위 5 안에 정답이 든 질의 수
    embedding_model: string | null;
    dataset_version: string | null; run_at: string;
  } | null;
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

// GET /me 응답 (AuthController.Me). 로그인 사용자
export interface Me {
  id: number;
  employee_no: string;
  name: string;
  title: string | null;
  email: string | null;
  workspace_id: number | null;
  workspaces: { id: number; name: string; policy_enabled: boolean; case_enabled: boolean; role: string; can_configure: boolean }[]; // kind='dept' 만
  must_change_password: boolean;
  consent_required: boolean;
  password_expires_at: string | null;
  company_admin: boolean; // 전사 공통(kind≠dept) ws 의 admin. 전사 ws 는 workspaces[]에 넣지 않는다(부서만)
}

// ── 관리자 (UserAdminController · WorkspaceController) ──
export type MemberRole = "admin" | "member";
export interface Member { id: number; employee_no: string; name: string; title: string | null; email_masked: string | null; role: MemberRole; locked: boolean }
export interface InviteInput { employee_no: string; name: string; email?: string; title?: string; role: MemberRole }
// temp_password: 새 계정일 때만 1회 내려온다(created=false 면 null — 기존 계정을 멤버로만 추가). 화면 밖으로 남기지 않는다
export interface InviteResult { id: number; employee_no: string; name: string; workspace_id: number; role: MemberRole; created: boolean; temp_password: string | null }
// GET /workspaces/manageable — 설정을 바꿀 수 있는 부서. policy_docs = 상위 포함 활성 규정 수, cases = 활성 사례 수
export interface ManageableWorkspace { id: number; name: string; policy_enabled: boolean; case_enabled: boolean; parent_id: number | null; policy_docs: number; cases: number }

// ── 사례의 근거 조문 입력 (PolicyRefService.RefInput / ArticleOption) — 최대 5건 ──
// follows·exception: policy(문서 slug)+article(조문 표기) 필수. gap: topic(무엇에 대한 기준이 없나) 필수
export interface PolicyRefInput { relation: PolicyRelation; policy?: string; article?: string; note?: string; topic?: string }
export interface PolicyArticleOption { policy: string; doc_title: string; article: string; article_label: string }

// ── 규정 개정 영향 (GET /policy-revisions/impact, PolicyRevisionController) ──
// 개정(폐기)된 규정 조문을 근거로 적은 이 부서 사례. same 조문 그대로 · amended 조문 내용 바뀜(사례는 옛 기준) · replaced 대응 조문 없음(다시 연결 필요)
export type RevisionStatus = "same" | "amended" | "replaced";
export interface RevisionImpactItem {
  node_id: number; title: string; type: LogType; relation: PolicyRelation; policy: string; article: string; note: string | null; status: RevisionStatus;
  from_label: string | null; current_policy: string | null; current_title: string | null; current_version: string | null; current_label: string | null;
  suggested_article: string | null; suggested_label: string | null; // replaced 일 때 내용이 가장 가까운 새 조문(제안, 사람이 확인)
}
export interface RevisionImpact { cases: number; summary: Record<RevisionStatus, number>; items: RevisionImpactItem[] }

