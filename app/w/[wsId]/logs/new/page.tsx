import { Suspense } from "react";
import { Header } from "@/components/shell/Header";
import { WeeklyChip } from "@/components/shell/WeeklyChip";
import { RegisterScreen } from "@/components/blocks/RegisterScreen";
import { getChain, getLogs, getRecentLogs, getWeeklyCount, requestNonce } from "@/lib/api";
import { resolveWs } from "@/lib/ws";

async function Content({ params, searchParams }: { params: Promise<{ wsId: string }>; searchParams: Promise<{ parent?: string }> }) {
  const ws = await resolveWs(params);
  const { parent } = await searchParams;
  const [recent, weekly, { items }, nonce] = await Promise.all([getRecentLogs(ws.id, 8), getWeeklyCount(ws.id), getLogs(ws.id), requestNonce()]);
  const initialPreview = parent ? await getChain(ws.id, Number(parent)) : null;
  return (
    <>
      <Header title="업무로그 등록" subtitle="짧게 적어도 됩니다. AI가 에러 코드·키워드·요약을 뽑아 검색되게 만듭니다" ws={ws} right={<WeeklyChip initial={weekly} />} />
      <RegisterScreen key={`${ws.id}-${parent ?? "none"}-${nonce}`} wsId={ws.id} candidates={items} initialRecent={recent} initialParent={parent} initialPreview={initialPreview} />
    </>
  );
}

// cacheComponents: searchParams(?parent=)를 읽으므로 Suspense
export default function NewLogPage(props: { params: Promise<{ wsId: string }>; searchParams: Promise<{ parent?: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-ink-muted">불러오는 중…</div>}>
      <Content {...props} />
    </Suspense>
  );
}
