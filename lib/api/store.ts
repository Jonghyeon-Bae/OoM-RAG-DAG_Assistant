// 서버 메모리 목업 저장소. dev 서버가 살아 있는 동안 등록 결과가 유지된다. 3단계에서 Spring API로 교체.
import type { LogNode, PolicyDocument, DocEvent } from "@/lib/types/domain";
import docsSeed from "@/mocks/documents.json";
import eventsSeed from "@/mocks/doc-events.json";
import logsSeed from "@/mocks/logs.json";
import edgesSeed from "@/mocks/edges.json";

type Edge = { parent_id: number; child_id: number };
export type StoreNode = LogNode & { refine_started_at?: number };

const g = globalThis as unknown as { __oomStore?: { nodes: StoreNode[]; edges: Edge[]; nextId: number; docs: PolicyDocument[]; docEvents: DocEvent[] } };
if (!g.__oomStore) {
  g.__oomStore = { nodes: [...(logsSeed as StoreNode[])], edges: [...(edgesSeed as Edge[])], nextId: 200, docs: [...(docsSeed as PolicyDocument[])], docEvents: [...(eventsSeed as DocEvent[])] };
}
// 서버 재시작 없이 필드가 추가된 경우(HMR은 globalThis를 유지) 누락분만 시드로 채운다
g.__oomStore.docs ??= [...(docsSeed as PolicyDocument[])];
g.__oomStore.docEvents ??= [...(eventsSeed as DocEvent[])];
export const store = g.__oomStore;
