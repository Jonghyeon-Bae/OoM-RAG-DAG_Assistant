import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Header } from "@/components/shell/Header";
import { DocumentsView } from "@/components/blocks/DocumentsView";
import { getDocuments, getDocumentEvents, getUploads } from "@/lib/api";
import { getCurrentUser } from "@/lib/api/session";
import { accessOf } from "@/lib/access";
import { resolveWs } from "@/lib/ws";

// 규정 문서 관리 (백엔드 #37·#44). 규정을 쓰는 부서만. 목록·이력·조문은 소속 누구나, 올리기·검수·폐기는 관리자(서버가 문서마다 can_manage 로 판정)
export default async function DocumentPage({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await resolveWs(params);
  if (!ws.policy_enabled) notFound();
  return (
    <>
      <Header title="규정 문서 관리" subtitle="어시스턴트가 인용하는 규정을 올리고, 판과 상태를 관리합니다" ws={ws} />
      <Suspense fallback={<main className="p-8 text-sm text-ink-muted">불러오는 중…</main>}>
        <Content wsId={ws.id} />
      </Suspense>
    </>
  );
}

async function Content({ wsId }: { wsId: number }) {
  const [docs, events, uploads, me] = await Promise.all([getDocuments(wsId), getDocumentEvents(wsId), getUploads(wsId), getCurrentUser()]);
  const a = accessOf(me, wsId);
  // 이 부서 규정 올리기 = 이 부서 admin 또는 회사 관리자(상위 admin). 전사 공통 = 회사 관리자
  return <DocumentsView key={wsId} wsId={wsId} initial={docs} initialEvents={events} initialUploads={uploads} canUpload={a.wsAdmin || me.company_admin} companyAdmin={me.company_admin} />;
}
