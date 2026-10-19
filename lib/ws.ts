import { workspaces } from "@/lib/fixtures";

export async function getWs(params: Promise<{ wsId: string }>) {
  const { wsId } = await params;
  return workspaces.find((w) => String(w.id) === wsId) ?? workspaces[0];
}
