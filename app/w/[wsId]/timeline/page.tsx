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
  searchParams: Promise<{ entry?: string; resolved?: string }>;
}) {
  const ws = await resolveWs(params);
  const sp = await searchParams;
  const { items } = await getLogs(ws.id);
  // 기본 선택은 최신 로그가 아니라 최근 활동이 있는 장애 건(루트) — 흐름 그래프가 가지 하나만 보이지 않게 (UX-003 B4)
  const latestRoot = items[0] ? items.find((l) => l.id === items[0].root_id)?.id ?? items[0].root_id : 0;
  const initialEntry = Number(sp.entry ?? latestRoot);
  const initialChain = await getChain(ws.id, initialEntry);
  const initialShowResolved = sp.resolved === "1";
  return (
    <>
      <Header title="트러블슈팅 타임라인" subtitle="장애 건마다 원인과 해결을 순서대로 모아 보여줍니다" ws={ws} />
      <TimelineView key={`${ws.id}-${initialEntry}-${initialShowResolved}`} wsId={ws.id} logs={items} initialEntry={initialEntry} initialChain={initialChain} initialShowResolved={initialShowResolved} />
    </>
  );
}

// cacheComponents: searchParams를 읽는 부분은 Suspense 안에서 동적으로 렌더된다.
export default function TimelinePage(props: { params: Promise<{ wsId: string }>; searchParams: Promise<{ entry?: string; resolved?: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-ink-muted">타임라인을 불러오는 중…</div>}>
      <TimelineContent {...props} />
    </Suspense>
  );
}
