// 클라이언트 컴포넌트용. 브라우저 → /api/v1 (next.config rewrites → Spring :8080).
// 일반 요청은 axios, 채팅 SSE 만 fetch (axios 는 브라우저에서 스트림을 조각으로 못 받는다).
import axios from "axios";
import type { Chain, ChatEvent, SearchSession, LogNode, LogType, PolicyDocument, PolicyChunk, DocStatus, DocEvent } from "@/lib/types/domain";

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
      window.location.assign("/");
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
};
export type ApiFail = { ok: false; code?: string; message: string };
const fail = (e: unknown, what: string): ApiFail => {
  const b = errBody(e);
  return { ok: false, code: b?.code, message: (b?.code && codeText[b.code]) ?? b?.message ?? `${what} 실패 (${httpStatus(e) ?? "네트워크"})` };
};

// ── 로그·체인 ────────────────────────────────────────────────────────────────
export async function fetchChain(wsId: number, entryId: number): Promise<Chain | null> {
  try {
    const { data } = await api.get<Chain>(`/chains/${entryId}`, ws(wsId));
    return data;
  } catch (e) {
    if (httpStatus(e) === 404) return null;
    throw e;
  }
}

export async function postLog(wsId: number, input: { type: LogType; title: string; body: string; parent_id: number | null; resolve_root?: boolean; problem_title?: string }): Promise<LogNode> {
  try {
    const { data } = await api.post<LogNode>("/logs", input, ws(wsId));
    return data;
  } catch (e) {
    throw new Error(errBody(e)?.message ?? `등록 실패 (${httpStatus(e)})`);
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
    window.location.assign("/");
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

// ── 규정 문서 — 백엔드 API 는 게이트(11/06) 뒤. 메뉴 비활성 상태라 지금은 호출되지 않는다 ──
export async function patchDocStatus(wsId: number, id: number, status: DocStatus, reason?: string): Promise<PolicyDocument | null> {
  try {
    const { data } = await api.patch<PolicyDocument>(`/documents/${id}`, { status, reason }, ws(wsId));
    return data;
  } catch {
    return null;
  }
}

export async function deleteDoc(wsId: number, id: number): Promise<{ ok: boolean; message?: string }> {
  try {
    await api.delete(`/documents/${id}`, ws(wsId));
    return { ok: true };
  } catch (e) {
    return { ok: false, message: errBody(e)?.message };
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
