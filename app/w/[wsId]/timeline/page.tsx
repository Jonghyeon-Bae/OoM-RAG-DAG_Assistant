import { Suspense } from "react";
import { Header } from "@/components/shell/Header";
import { TimelineView } from "@/components/blocks/TimelineView";
import { getLogs, getChain } from "@/lib/api";
import { resolveWs } from "@/lib/ws";

async function TimelineContent({
  params,
  searchParams,
}: {
  params: Promise<{ wsId: string }>;
  searchParams: Promise<{ entry?: string }>;
}) {
  const ws = await resolveWs(params);
  const sp = await searchParams;
  const { items } = await getLogs(ws.id);
  const initialEntry = Number(sp.entry ?? items[0]?.id ?? 0);
  const initialChain = await getChain(ws.id, initialEntry);
  return (
    <>
      <Header title="트러블슈팅 타임라인" subtitle="실패·성공·참고 로그를 부모-자식 트리(DAG)로 연결해 보여줍니다" ws={ws} />
      <TimelineView key={`${ws.id}-${initialEntry}`} wsId={ws.id} logs={items} initialEntry={initialEntry} initialChain={initialChain} />
    </>
  );
}

// cacheComponents: searchParams를 읽는 부분은 Suspense 안에서 동적으로 렌더된다.
export default function TimelinePage(props: { params: Promise<{ wsId: string }>; searchParams: Promise<{ entry?: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-ink-muted">타임라인을 불러오는 중…</div>}>
      <TimelineContent {...props} />
    </Suspense>
  );
}
