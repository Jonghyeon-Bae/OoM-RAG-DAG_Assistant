import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/api";
import type { Workspace } from "@/lib/types/domain";

// 페이지용 워크스페이스 조회. 없으면 404 — 소속 확인은 app/w/[wsId]/layout.tsx 가드가 먼저 한다.
// (이전엔 못 찾으면 { id: 1, ... } 를 지어내 다른 부서 화면을 그릴 수 있었다)
export async function resolveWs(params: Promise<{ wsId: string }>): Promise<Workspace> {
  const { wsId } = await params;
  const ws = await getWorkspace(Number(wsId));
  if (!ws) notFound();
  return ws;
}
