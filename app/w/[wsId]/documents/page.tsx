import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Header } from "@/components/shell/Header";
import { DocumentsView } from "@/components/blocks/DocumentsView";
import { getDocuments, getDocumentEvents } from "@/lib/api";
import { resolveWs } from "@/lib/ws";

export default async function Page({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await resolveWs(params);
  if (!ws.policy_enabled) notFound();
  return (
    <>
      <Header title="규정 문서 관리" subtitle="어시스턴트가 인용하는 규정의 버전과 상태를 관리합니다" ws={ws} />
      <Suspense fallback={<main className="p-8 text-sm text-ink-muted">불러오는 중…</main>}>
        <Content wsId={ws.id} />
      </Suspense>
    </>
  );
}

async function Content({ wsId }: { wsId: number }) {
  const [docs, events] = await Promise.all([getDocuments(wsId), getDocumentEvents(wsId)]);
  return <DocumentsView key={wsId} wsId={wsId} initial={docs} initialEvents={events} />;
}
