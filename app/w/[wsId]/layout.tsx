import { notFound } from "next/navigation";
import { workspaces } from "@/lib/fixtures";
import { Sidebar } from "@/components/shell/Sidebar";

export function generateStaticParams() {
  return workspaces.map((w) => ({ wsId: String(w.id) }));
}

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ wsId: string }>;
}) {
  const { wsId } = await params;
  const ws = workspaces.find((w) => String(w.id) === wsId);
  if (!ws) notFound();
  return (
    <div className="flex-1 flex min-h-screen">
      <Sidebar wsId={ws.id} policyEnabled={ws.policy_enabled} />
      <div className="flex-1 flex flex-col min-w-0">{children}</div>
    </div>
  );
}
