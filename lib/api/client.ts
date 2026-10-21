// 클라이언트 컴포넌트용. 목업 라우트(app/api/mock) → 3단계에서 NEXT_PUBLIC_API_BASE 로 교체.
import type { Chain, LogNode, LogType } from "@/lib/types/domain";

const base = process.env.NEXT_PUBLIC_API_BASE ?? "/api/mock";
const headers = (wsId: number) => ({ "Content-Type": "application/json", "X-Workspace-Id": String(wsId) });

export async function fetchChain(wsId: number, entryId: number): Promise<Chain | null> {
  const r = await fetch(`${base}/chains/${entryId}`, { headers: headers(wsId) });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`chain ${r.status}`);
  return r.json();
}

export async function postLog(wsId: number, input: { type: LogType; title: string; body: string; parent_id: number | null; resolve_root?: boolean }): Promise<LogNode> {
  const r = await fetch(`${base}/logs`, { method: "POST", headers: headers(wsId), body: JSON.stringify(input) });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.message ?? `등록 실패 (${r.status})`);
  }
  return r.json();
}

export async function fetchLog(wsId: number, id: number): Promise<LogNode | null> {
  const r = await fetch(`${base}/logs/${id}`, { headers: headers(wsId), cache: "no-store" });
  return r.ok ? r.json() : null;
}

export async function fetchRecentLogs(wsId: number, limit = 8): Promise<LogNode[]> {
  const r = await fetch(`${base}/logs?limit=${limit}`, { headers: headers(wsId), cache: "no-store" });
  return r.ok ? r.json() : [];
}

export async function postRefine(wsId: number, id: number): Promise<LogNode | null> {
  const r = await fetch(`${base}/logs/${id}/refine`, { method: "POST", headers: headers(wsId) });
  return r.ok ? r.json() : null;
}

export async function patchStatus(wsId: number, id: number, status: "active" | "deprecated", reason?: string, cascade = false): Promise<(LogNode & { affected: number[] }) | null> {
  const r = await fetch(`${base}/logs/${id}`, { method: "PATCH", headers: headers(wsId), body: JSON.stringify({ status, reason, cascade }) });
  return r.ok ? r.json() : null;
}

export async function fetchOrphaned(wsId: number, id: number): Promise<number[]> {
  const r = await fetch(`${base}/logs/${id}`, { method: "OPTIONS", headers: headers(wsId) });
  return r.ok ? (await r.json()).orphaned : [];
}

export async function patchResolved(wsId: number, id: number, resolved: boolean): Promise<LogNode | null> {
  const r = await fetch(`${base}/logs/${id}`, { method: "PATCH", headers: headers(wsId), body: JSON.stringify({ resolved }) });
  return r.ok ? r.json() : null;
}
