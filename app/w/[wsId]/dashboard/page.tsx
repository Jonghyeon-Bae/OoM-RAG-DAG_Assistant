import { Suspense } from "react";
import { Header } from "@/components/shell/Header";
import { Chip } from "@/components/ui";
import { DashboardView } from "@/components/blocks/DashboardView";
import { getDashboardSummary } from "@/lib/api";
import { resolveWs } from "@/lib/ws";

async function Content({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await resolveWs(params);
  const data = await getDashboardSummary(ws.id);
  return (
    <>
      <Header title="성과 대시보드" subtitle="도입 효과와 답변 품질을 한눈에 확인합니다" ws={ws} right={<Chip>이번 주 등록 {data.logs.week}건</Chip>} />
      <DashboardView wsId={ws.id} data={data} />
    </>
  );
}

// 집계가 요청 시점 값(connection)이므로 Suspense
export default function DashboardPage(props: { params: Promise<{ wsId: string }> }) {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-ink-muted">집계 중…</div>}>
      <Content {...props} />
    </Suspense>
  );
}
