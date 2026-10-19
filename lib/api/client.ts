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
  if (!r.ok) throw new Error(`createLog ${r.status}`);
  return r.json();
}
