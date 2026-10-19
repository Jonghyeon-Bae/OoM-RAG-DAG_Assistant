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
  resolved_at: string | null; // 루트(장애 건) 완료 시각. 루트에만 의미 (TODO:04 쟁점 10)
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
