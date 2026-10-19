// 서버 메모리 목업 저장소. dev 서버가 살아 있는 동안 등록 결과가 유지된다. 3단계에서 Spring API로 교체.
import type { LogNode } from "@/lib/types/domain";
import logsSeed from "@/mocks/logs.json";
import edgesSeed from "@/mocks/edges.json";

type Edge = { parent_id: number; child_id: number };
export type StoreNode = LogNode & { refine_started_at?: number };

const g = globalThis as unknown as { __oomStore?: { nodes: StoreNode[]; edges: Edge[]; nextId: number } };
if (!g.__oomStore) {
  g.__oomStore = { nodes: [...(logsSeed as StoreNode[])], edges: [...(edgesSeed as Edge[])], nextId: 200 };
}
export const store = g.__oomStore;
