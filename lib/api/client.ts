// 클라이언트 컴포넌트용. 브라우저 → /api/v1 (next.config rewrites → Spring :8080).
// 일반 요청은 axios, 채팅 SSE 만 fetch (axios 는 브라우저에서 스트림을 조각으로 못 받는다).
import axios from "axios";
import type { Chain, ChatEvent, SearchSession, LogNode, LogType, PolicyDocument, PolicyChunk, DocStatus, DocEvent, PolicyUpload, Member, MemberRole, InviteInput, InviteResult, Workspace, PolicyRefInput, PolicyArticleOption } from "@/lib/types/domain";

const BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";

// 공통 설정: 주소·JSON 헤더·쿠키 전송을 여기서 한 번만
const api = axios.create({
  baseURL: BASE,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// 401(로그인 없음·만료) → 첫 화면으로. 로그인 요청 자체의 401 은 제외(무한 이동 방지)
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (axios.isAxiosError(err) && err.response?.status === 401 && err.config?.url !== "/auth/login" && typeof window !== "undefined") {
      window.location.assign("/login");
    }
    return Promise.reject(err);
  },
);

// Spring 이 이 헤더로 워크스페이스 소속을 확인한다 (TenantContextFilter)
const ws = (wsId: number) => ({ headers: { "X-Workspace-Id": String(wsId) } });

// Spring 에러 응답 {code, message} 와 상태 코드 꺼내기
const errBody = (e: unknown) => (axios.isAxiosError(e) ? (e.response?.data as { code?: string; message?: string } | undefined) : undefined);
const httpStatus = (e: unknown) => (axios.isAxiosError(e) ? e.response?.status : undefined);
// 서버 업무 코드({code}) → 사용자 문구. 없으면 서버 message, 그것도 없으면 상태 코드 포함 일반 문구
const codeText: Record<string, string> = {
  REASON_REQUIRED: "폐기 사유를 입력해 주세요",
  INVALID_STATUS: "지금 상태에서는 할 수 없는 변경입니다. 화면을 새로 고쳐 주세요",
  PARENT_DEPRECATED: "이어 붙일 상위 로그가 폐기되어 있습니다. 먼저 복원해 주세요",
  PARENT_NOT_FOUND: "상위 로그를 찾을 수 없습니다",
  NOTE_REQUIRED: "이어진 성공 로그가 없어 완료 사유가 필요합니다",
  NOT_ROOT: "시작 로그에서만 할 수 있습니다",
  REF_ROOT: "참고 자료는 완료 처리 대상이 아닙니다",
  PROBLEM_TITLE_REQUIRED: "어떤 문제를 해결했는지 제목을 적어 주세요",
  RESOLVED_NODE_INVALID: "고른 기록 중 이 장애 건의 해결 기록이 될 수 없는 것이 있습니다. 화면을 새로 고쳐 주세요",
  CATEGORY_INVALID: "원인 표시는 상위가 있는 실패 기록에만 할 수 있습니다",
  POLICY_REF_NOT_FOUND: "그 조문을 찾을 수 없습니다. 폐기된 구판 조문일 수 있습니다",
  // 관리자 (D-5)
  FORBIDDEN: "권한이 없습니다",
  EMPLOYEE_NO_TAKEN: "다른 회사에서 이미 쓰는 사번입니다",
  ALREADY_MEMBER: "이미 이 워크스페이스의 멤버입니다",
  NO_SOURCE: "규정과 해결 사례를 모두 끌 수는 없습니다",
  SELF_DEMOTION: "자기 자신의 관리자 권한은 내릴 수 없습니다",
  SELF_REMOVAL: "자기 자신은 부서에서 제외할 수 없습니다",
  LAST_ADMIN: "부서에 관리자가 한 명은 있어야 합니다. 다른 관리자를 먼저 지정해 주세요",
  // FE-REQ-004 (계정 비활성화·재활성화·비밀번호 재발급) — 백엔드 구현 전 제안 코드
  SELF_DEACTIVATION: "자기 자신의 계정은 비활성화할 수 없습니다",
  LAST_COMPANY_ADMIN: "회사 관리자가 한 명은 있어야 합니다",
  ALREADY_INACTIVE: "이미 비활성화된 계정입니다",
  // 규정 문서·업로드 (백엔드 #37·#44)
  SUPERSEDED: "새 판으로 대체된 문서라 복원할 수 없습니다 — 두 판이 함께 검색되기 때문입니다",
  NOT_RETIRED: "폐기한 문서만 삭제할 수 있습니다",
  DOCUMENT_IN_USE: "이 문서를 근거로 적은 사례나 이전 판이 있어 삭제할 수 없습니다. 폐기만 해 두세요",
  SLUG_TAKEN: "이미 쓰는 문서 ID입니다. 다른 ID를 정해 주세요",
  UNSUPPORTED_FORMAT: "PDF · HWP · HWPX · Word(docx) · MD · TXT만 올릴 수 있습니다",
  SUPERSEDES_NOT_FOUND: "대체할 문서를 찾지 못했습니다(사용 중인 문서만 대체할 수 있습니다)",
  NOT_IN_REVIEW: "검수 중인 건만 할 수 있습니다. 화면을 새로 고쳐 주세요",
  NO_ARTICLES: "변환본에서 조문(제N조·별표·Q)을 하나도 찾지 못해 승인할 수 없습니다. 변환본을 고쳐 주세요",
  NOT_FAILED: "변환에 실패한 건만 다시 변환할 수 있습니다",
};
export type ApiFail = { ok: false; code?: string; message: string };
const fail = (e: unknown, what: string): ApiFail => {
  const b = errBody(e);
  return { ok: false, code: b?.code, message: (b?.code && codeText[b.code]) ?? b?.message ?? `${what} 실패 (${httpStatus(e) ?? "네트워크"})` };
};

// ── 로그·체인 ────────────────────────────────────────────────────────────────
// summarize:false = 요약을 그리지 않는 화면(등록 미리보기). 서버가 AI 요약 생성을 시작하지 않는다(백엔드 #48, 비용)
export async function fetchChain(wsId: number, entryId: number, opts?: { summarize?: boolean }): Promise<Chain | null> {
  try {
    const { data } = await api.get<Chain>(`/chains/${entryId}${opts?.summarize === false ? "?summarize=false" : ""}`, ws(wsId));
    return data;
  } catch (e) {
    if (httpStatus(e) === 404) return null;
    throw e;
  }
}

export async function postLog(wsId: number, input: { type: LogType; title: string; body: string; parent_id: number | null; resolve_root?: boolean; problem_title?: string; policy_refs?: PolicyRefInput[] }): Promise<LogNode> {
  try {
    const { data } = await api.post<LogNode>("/logs", input, ws(wsId));
    return data;
  } catch (e) {
    throw new Error(fail(e, "등록").message); // 업무 코드는 codeText 문구로 (POLICY_REF_NOT_FOUND 등)
  }
}

// 등록 화면의 근거 조문 고르기 — 이 부서(상위 포함)에서 검색되는 활성 규정의 조문만 (요청 J, D-2)
export async function fetchPolicyArticles(wsId: number, q: string, limit = 20): Promise<PolicyArticleOption[]> {
  try {
    const { data } = await api.get<PolicyArticleOption[]>("/logs/policy-articles", { ...ws(wsId), params: { q, limit } });
    return data;
  } catch {
    return [];
  }
}

export async function fetchLog(wsId: number, id: number): Promise<LogNode | null> {
  try {
    const { data } = await api.get<LogNode>(`/logs/${id}`, ws(wsId));
    return data;
  } catch {
    return null;
  }
}

// 응답 형태 차이 ①: 목업은 배열, 실서버는 {items, counts}
export async function fetchRecentLogs(wsId: number, limit = 8): Promise<LogNode[]> {
  try {
    const { data } = await api.get<{ items: LogNode[] }>("/logs", { ...ws(wsId), params: { limit } });
    return data.items;
  } catch {
    return [];
  }
}

// 워크스페이스 전체 로그 (등록 직후 "이어서 적을" 후보 갱신용). limit=0 = 전체
export async function fetchLogs(wsId: number): Promise<LogNode[]> {
  try {
    const { data } = await api.get<{ items: LogNode[] }>("/logs", { ...ws(wsId), params: { limit: 0 } });
    return data.items;
  } catch {
    return [];
  }
}

export async function postRefine(wsId: number, id: number): Promise<LogNode | null> {
  try {
    const { data } = await api.post<LogNode>(`/logs/${id}/refine`, null, ws(wsId));
    return data;
  } catch {
    return null;
  }
}

// 실패를 null로 삼키지 않는다 — 400 REASON_REQUIRED 등은 화면이 문구로 보여줘야 할 재료(CR-001 §4-2)
export async function patchStatus(wsId: number, id: number, status: "active" | "deprecated", reason?: string, cascade = false): Promise<{ ok: true; node: LogNode; affected: number[] } | ApiFail> {
  try {
    const { data } = await api.patch<LogNode & { affected: number[] }>(`/logs/${id}`, { status, reason, cascade }, ws(wsId));
    const { affected, ...node } = data;
    return { ok: true, node, affected: affected ?? [] };
  } catch (e) {
    return fail(e, status === "deprecated" ? "폐기" : "복원");
  }
}

// 응답 형태 차이 ②: 목업 OPTIONS → 실서버 GET /logs/{id}/orphaned
export async function fetchOrphaned(wsId: number, id: number): Promise<number[]> {
  try {
    const { data } = await api.get<{ orphaned: number[] }>(`/logs/${id}/orphaned`, ws(wsId));
    return data.orphaned;
  } catch {
    return [];
  }
}

// 완료/해제. 성공 로그가 없으면 서버가 409 NOTE_REQUIRED 를 주고, note 를 받아 다시 보낸다
export async function patchResolved(wsId: number, id: number, resolved: boolean, note?: string): Promise<{ ok: true; node: LogNode } | { ok: false; code?: string; message: string }> {
  try {
    const { data } = await api.patch<LogNode>(`/logs/${id}`, { resolved, note }, ws(wsId));
    return { ok: true, node: data };
  } catch (e) {
    return fail(e, "완료 처리");
  }
}

// ── 어시스턴트 ───────────────────────────────────────────────────────────────
// 채팅 SSE 수신 — fetch 유지. "event: 이름 / data: JSON" 블록을 \n\n 단위로 파싱해 onEvent 로 넘긴다
export async function streamChat(wsId: number, query: string, onEvent: (e: ChatEvent) => void, signal?: AbortSignal): Promise<void> {
  const r = await fetch(`${BASE}/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "X-Workspace-Id": String(wsId), Accept: "text/event-stream" },
    body: JSON.stringify({ query }),
    signal,
  });
  if (r.status === 401) {
    window.location.assign("/login");
    return;
  }
  if (!r.ok || !r.body) throw new Error(`chat ${r.status}`);

  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      let event = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
      }
      if (!data.length) continue;
      try {
        onEvent({ event, data: JSON.parse(data.join("\n")) } as ChatEvent);
      } catch {
        /* 깨진 블록은 무시 */
      }
    }
  }
}

// 검색 내역
export async function fetchSessions(wsId: number, limit = 30): Promise<SearchSession[]> {
  try {
    const { data } = await api.get<SearchSession[]>("/sessions", { ...ws(wsId), params: { limit } });
    return data;
  } catch {
    return [];
  }
}

// 응답 형태 차이 ③: 목업 PATCH /sessions/{id} → 실서버 POST /feedback (score null = 철회). 204
export async function patchSessionScore(wsId: number, id: number, score: 1 | -1 | null): Promise<boolean> {
  try {
    await api.post("/feedback", { session_id: id, score }, ws(wsId));
    return true;
  } catch {
    return false;
  }
}

// ── 규정 문서 (DocumentController · PolicyUploadController, 백엔드 #37·#44) ──
export async function fetchDocs(wsId: number): Promise<PolicyDocument[]> {
  try {
    const { data } = await api.get<PolicyDocument[]>("/documents", ws(wsId));
    return data;
  } catch {
    return [];
  }
}

export async function patchDocStatus(wsId: number, id: number, status: DocStatus, reason?: string): Promise<{ ok: true; doc: PolicyDocument } | ApiFail> {
  try {
    const { data } = await api.patch<PolicyDocument>(`/documents/${id}`, { status, reason }, ws(wsId));
    return { ok: true, doc: data };
  } catch (e) {
    return fail(e, status === "retired" ? "폐기" : "복원");
  }
}

export async function deleteDoc(wsId: number, id: number): Promise<{ ok: true } | ApiFail> {
  try {
    await api.delete(`/documents/${id}`, ws(wsId));
    return { ok: true };
  } catch (e) {
    return fail(e, "삭제");
  }
}

export async function fetchDocChunks(wsId: number, id: number): Promise<PolicyChunk[]> {
  try {
    const { data } = await api.get<PolicyChunk[]>(`/documents/${id}/chunks`, ws(wsId));
    return data;
  } catch {
    return [];
  }
}

export async function fetchDocEvents(wsId: number, documentId?: number): Promise<DocEvent[]> {
  try {
    const { data } = await api.get<DocEvent[]>("/documents/events", { ...ws(wsId), params: documentId ? { document_id: documentId } : undefined });
    return data;
  } catch {
    return [];
  }
}

export type UploadInput = { file: File; title: string; version: string; slug: string; doc_type?: string; supersedes?: string; scope: "dept" | "company" };
export async function uploadPolicy(wsId: number, input: UploadInput): Promise<{ ok: true; upload: PolicyUpload } | ApiFail> {
  const fd = new FormData();
  fd.append("file", input.file);
  fd.append("title", input.title);
  fd.append("version", input.version);
  fd.append("slug", input.slug);
  fd.append("scope", input.scope);
  if (input.doc_type) fd.append("doc_type", input.doc_type);
  if (input.supersedes) fd.append("supersedes", input.supersedes);
  // axios 인스턴스 기본 Content-Type 이 JSON 이라 FormData 를 JSON 으로 바꿔 버린다 → fetch 로 보내 브라우저가 경계(boundary)를 붙이게 한다
  try {
    const res = await fetch(`${BASE}/documents/uploads`, { method: "POST", body: fd, credentials: "include", headers: { "X-Workspace-Id": String(wsId) } });
    const body = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, code: body?.code, message: (body?.code && codeText[body.code]) ?? body?.message ?? `업로드 실패 (${res.status})` };
    return { ok: true, upload: body as PolicyUpload };
  } catch {
    return { ok: false, message: "업로드 실패 (네트워크)" };
  }
}

export async function fetchUploads(wsId: number): Promise<PolicyUpload[]> {
  try {
    const { data } = await api.get<PolicyUpload[]>("/documents/uploads", ws(wsId));
    return data;
  } catch {
    return [];
  }
}

export async function fetchUpload(wsId: number, id: number): Promise<PolicyUpload | null> {
  try {
    const { data } = await api.get<PolicyUpload>(`/documents/uploads/${id}`, ws(wsId));
    return data;
  } catch {
    return null;
  }
}

// 검수 동작: markdown 저장(→ 재변환) · approve(→ 등록) · reject(사유) · retry(실패 건)
export async function uploadAction(wsId: number, id: number, action: "markdown" | "approve" | "reject" | "retry", body?: { markdown?: string; reason?: string }): Promise<{ ok: true; upload: PolicyUpload } | ApiFail> {
  try {
    const { data } = action === "markdown"
      ? await api.put<PolicyUpload>(`/documents/uploads/${id}/markdown`, { markdown: body?.markdown }, ws(wsId))
      : await api.post<PolicyUpload>(`/documents/uploads/${id}/${action}`, action === "reject" ? { reason: body?.reason } : null, ws(wsId));
    return { ok: true, upload: data };
  } catch (e) {
    return fail(e, { markdown: "변환본 저장", approve: "승인", reject: "반려", retry: "다시 변환" }[action]);
  }
}

// 원본·검수본 내려받기 — X-Workspace-Id 헤더가 필요해 링크 대신 받아서 저장한다
export async function downloadUploadFile(wsId: number, id: number, kind: "original" | "markdown", fallbackName: string): Promise<{ ok: true } | ApiFail> {
  try {
    const res = await api.get<Blob>(`/documents/uploads/${id}/${kind}`, { ...ws(wsId), responseType: "blob" });
    const cd = String(res.headers["content-disposition"] ?? "");
    const m = /filename\*=UTF-8''([^;]+)/i.exec(cd) ?? /filename="?([^";]+)"?/i.exec(cd);
    const name = m ? decodeURIComponent(m[1]) : fallbackName;
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return { ok: true };
  } catch (e) {
    return fail(e, "내려받기");
  }
}

// ── 관리자 (D-5, FE-013 §3.1) — 백엔드 UserAdminController · WorkspaceController ──
// 멤버 목록·초대·잠금 해제는 "현재 워크스페이스의 admin"(X-Workspace-Id 기준), 부서 설정은 can_configure(로그인 사용자 기준)
export async function inviteUser(wsId: number, body: InviteInput): Promise<{ ok: true; data: InviteResult } | ApiFail> {
  try {
    const { data } = await api.post<InviteResult>("/users", body, ws(wsId));
    return { ok: true, data };
  } catch (e) {
    return fail(e, "초대");
  }
}

export async function unlockUser(wsId: number, userId: number): Promise<{ ok: true } | ApiFail> {
  try {
    await api.post(`/users/${userId}/unlock`, null, ws(wsId));
    return { ok: true };
  } catch (e) {
    return fail(e, "잠금 해제");
  }
}

// 역할 변경 · 부서에서 제외 — 백엔드 UserAdminController (main 459a8a1 기준 구현됨)
export async function changeMemberRole(wsId: number, userId: number, role: MemberRole): Promise<{ ok: true; member: Member } | ApiFail> {
  try {
    const { data } = await api.patch<Member>(`/users/${userId}`, { role }, ws(wsId));
    return { ok: true, member: data };
  } catch (e) {
    return fail(e, "역할 변경");
  }
}

export async function removeMember(wsId: number, userId: number): Promise<{ ok: true } | ApiFail> {
  try {
    await api.delete(`/workspaces/${wsId}/members/${userId}`, ws(wsId));
    return { ok: true };
  } catch (e) {
    return fail(e, "부서에서 제외");
  }
}

// 계정 비활성화(퇴사·장기 미사용)·재활성화·임시 비밀번호 재발급 — 회사 관리자. 백엔드 미구현: FE-REQ-004 제안 경로
// 서버에 생기면 ACCOUNT_API_READY 만 true 로 바꾼다(화면은 이미 연결돼 있다)
export const ACCOUNT_API_READY = false;
export async function deactivateUser(wsId: number, userId: number, reason: string): Promise<{ ok: true } | ApiFail> {
  try {
    await api.post(`/users/${userId}/deactivate`, { reason }, ws(wsId));
    return { ok: true };
  } catch (e) {
    return fail(e, "계정 비활성화");
  }
}

export async function reactivateUser(wsId: number, userId: number): Promise<{ ok: true } | ApiFail> {
  try {
    await api.post(`/users/${userId}/reactivate`, null, ws(wsId));
    return { ok: true };
  } catch (e) {
    return fail(e, "계정 재활성화");
  }
}

export async function resetUserPassword(wsId: number, userId: number): Promise<{ ok: true; temp_password: string } | ApiFail> {
  try {
    const { data } = await api.post<{ temp_password: string }>(`/users/${userId}/reset-password`, null, ws(wsId));
    return { ok: true, temp_password: data.temp_password };
  } catch (e) {
    return fail(e, "임시 비밀번호 재발급");
  }
}

export async function fetchMembers(wsId: number): Promise<Member[]> {
  try {
    const { data } = await api.get<Member[]>("/users", ws(wsId));
    return data;
  } catch {
    return [];
  }
}

export async function patchWorkspaceSettings(id: number, body: { policy_enabled?: boolean; case_enabled?: boolean }): Promise<{ ok: true; data: Workspace } | ApiFail> {
  try {
    const { data } = await api.patch<Workspace>(`/workspaces/${id}`, body);
    return { ok: true, data };
  } catch (e) {
    return fail(e, "부서 설정");
  }
}
