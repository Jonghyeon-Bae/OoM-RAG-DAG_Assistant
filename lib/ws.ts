import { getWorkspace } from "@/lib/api";
import type { Workspace } from "@/lib/types/domain";

export async function resolveWs(params: Promise<{ wsId: string }>): Promise<Workspace> {
  const { wsId } = await params;
  return (await getWorkspace(Number(wsId))) ?? { id: 1, name: "SW 개발", policy_enabled: false };
}
