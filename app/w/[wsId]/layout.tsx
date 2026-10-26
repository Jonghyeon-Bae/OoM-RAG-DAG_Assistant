import { notFound } from "next/navigation";
import { getWorkspace, getWorkspaces } from "@/lib/api";
import { Sidebar } from "@/components/shell/Sidebar";

export async function generateStaticParams() {
  const ws = await getWorkspaces();
  return ws.map((w) => ({ wsId: String(w.id) }));
}

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ wsId: string }>;
}) {
  const { wsId } = await params;
  const ws = await getWorkspace(Number(wsId));
  if (!ws) notFound();
  return (
    <div className="flex min-h-screen flex-1 flex-col md:flex-row">
      <Sidebar wsId={ws.id} policyEnabled={ws.policy_enabled} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
