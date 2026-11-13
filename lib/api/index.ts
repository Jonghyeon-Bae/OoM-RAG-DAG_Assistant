// 데이터 접근 단일 지점 (서버 컴포넌트용). Spring /api/v1 을 호출한다. 목업 store·mocks 의존 없음.
// 함수 이름·반환 모양은 목업 때와 같게 유지 → page.tsx 는 고치지 않는다
import { connection } from "next/server";
import type { Workspace, Member, ManageableWorkspace, RevisionImpact, LogNode, LogCounts, Chain, DashboardSummary, PolicyDocument, DocEvent, PolicyUpload } from "@/lib/types/domain";
import { serverGet, serverGetOrNull } from "@/lib/api/server";

// 워크스페이스 — 로그인 상태면 내가 소속된 곳, 로그인 전이면 부서 목록 (GET /workspaces 는 로그인 없이 열림)
export async function getWorkspaces(): Promise<Workspace[]> {
  return serverGet<Workspace[]>("/workspaces");
}
export async function getWorkspace(id: number): Promise<Workspace | undefined> {
  return (await getWorkspaces()).find((w) => w.id === id);
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
export async function getChain(wsId: number, entryId: number, opts?: { summarize?: boolean }): Promise<Chain | null> {
  if (!entryId) return null; // 로그가 하나도 없는 워크스페이스
  return serverGetOrNull<Chain>(`/chains/${entryId}${opts?.summarize === false ? "?summarize=false" : ""}`, wsId);
}

// 대시보드 — 집계는 전부 서버
export async function getDashboardSummary(wsId: number): Promise<DashboardSummary> {
  return serverGet("/dashboard/summary", wsId);
}

// 규정 문서 (백엔드 #37 — 이 부서 + 상위 전사 공통). 404 면 빈 목록
export async function getDocuments(wsId: number): Promise<PolicyDocument[]> {
  return (await serverGetOrNull<PolicyDocument[]>("/documents", wsId)) ?? [];
}
export async function getDocumentEvents(wsId: number): Promise<DocEvent[]> {
  return (await serverGetOrNull<DocEvent[]>("/documents/events", wsId)) ?? [];
}
export async function getUploads(wsId: number): Promise<PolicyUpload[]> {
  return (await serverGetOrNull<PolicyUpload[]>("/documents/uploads", wsId)) ?? [];
}

// 요청마다 다른 값. 같은 URL 재진입 시 클라이언트 컴포넌트를 새로 마운트하는 key 용 (API 아님)
export async function requestNonce(): Promise<number> {
  await connection();
  return Date.now();
}

// 관리자 화면 초기값 (서버 컴포넌트). 권한이 없으면 403 → 빈 목록으로 두고 화면이 탭을 숨긴다
export async function getMembers(wsId: number): Promise<Member[]> {
  return serverGet<Member[]>("/users", wsId).catch(() => []);
}
export async function getManageable(): Promise<ManageableWorkspace[]> {
  return serverGet<ManageableWorkspace[]>("/workspaces/manageable").catch(() => []);
}

// 규정 개정 영향 (요청 K·L, D-3). 실패하면 null — 대시보드는 카드를 숨긴다
export async function getRevisionImpact(wsId: number): Promise<RevisionImpact | null> {
  return serverGet<RevisionImpact>("/policy-revisions/impact", wsId).catch(() => null);
}

