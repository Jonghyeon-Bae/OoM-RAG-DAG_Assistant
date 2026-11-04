// 데이터 접근 단일 지점 (서버 컴포넌트용). Spring /api/v1 을 호출한다. 목업 store·mocks 의존 없음.
// 함수 이름·반환 모양은 목업 때와 같게 유지 → page.tsx 는 고치지 않는다
import { connection } from "next/server";
import type { Workspace, User, LogNode, LogCounts, Chain, DashboardSummary, PolicyDocument, DocEvent } from "@/lib/types/domain";
import { serverGet, serverGetOrNull } from "@/lib/api/server";

// 워크스페이스 — 로그인 상태면 내가 소속된 곳, 로그인 전이면 부서 목록 (GET /workspaces 는 로그인 없이 열림)
export async function getWorkspaces(): Promise<Workspace[]> {
  return serverGet<Workspace[]>("/workspaces");
}
export async function getWorkspace(id: number): Promise<Workspace | undefined> {
  return (await getWorkspaces()).find((w) => w.id === id);
}

// 첫 화면(app/page.tsx)의 사용자 목록 — Spring GET /users 는 관리자 전용이라 로그인 전엔 받을 수 없다.
// 로그인 방식(JWT/OAuth2) 확정 전까지 빈 목록 (BE-CHECK-001 S8)
export async function getUsers(): Promise<User[]> {
  return [];
}

// 로그 — counts 는 active 만 센다(서버 규칙)
export async function getLogs(wsId: number): Promise<{ items: LogNode[]; counts: LogCounts }> {
  return serverGet(`/logs?limit=0`, wsId);
}
export async function getRecentLogs(wsId: number, limit = 5): Promise<LogNode[]> {
  return (await serverGet<{ items: LogNode[] }>(`/logs?limit=${limit}`, wsId)).items;
}
export async function getWeeklyCount(wsId: number): Promise<number> {
  return (await serverGet<{ count: number }>("/logs/weekly-count", wsId)).count;
}
export async function getChain(wsId: number, entryId: number): Promise<Chain | null> {
  if (!entryId) return null; // 로그가 하나도 없는 워크스페이스
  return serverGetOrNull<Chain>(`/chains/${entryId}`, wsId);
}

// 대시보드 — 집계는 전부 서버
export async function getDashboardSummary(wsId: number): Promise<DashboardSummary> {
  return serverGet("/dashboard/summary", wsId);
}

// 규정 문서 — 백엔드 API 는 게이트(11/06) 뒤. 그때까지 빈 목록 (메뉴도 비활성)
export async function getDocuments(_wsId: number): Promise<PolicyDocument[]> {
  return [];
}
export async function getDocumentEvents(_wsId: number): Promise<DocEvent[]> {
  return [];
}

// 요청마다 다른 값. 같은 URL 재진입 시 클라이언트 컴포넌트를 새로 마운트하는 key 용 (API 아님)
export async function requestNonce(): Promise<number> {
  await connection();
  return Date.now();
}
