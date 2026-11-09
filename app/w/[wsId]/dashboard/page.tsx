import { Suspense } from "react";
import { Header } from "@/components/shell/Header";
import { Chip } from "@/components/ui";
import { DashboardView } from "@/components/blocks/DashboardView";
import { getDashboardSummary, getRevisionImpact } from "@/lib/api";
import { RevisionImpactCard } from "@/components/blocks/RevisionImpactCard";
import { resolveWs } from "@/lib/ws";

async function Content({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await resolveWs(params);
  const [data, impact] = await Promise.all([getDashboardSummary(ws.id), ws.policy_enabled ? getRevisionImpact(ws.id) : Promise.resolve(null)]);
  return (
    <>
      <Header title="성과 대시보드" subtitle="도입 효과와 답변 품질을 한눈에 확인합니다" ws={ws} right={<Chip>이번 주 등록 {data.logs.week}건</Chip>} />
      {impact && impact.cases > 0 && <div className="px-4 pt-4 md:px-6 md:pt-6 xl:px-8 xl:pt-8"><RevisionImpactCard wsId={ws.id} impact={impact} /></div>}
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
