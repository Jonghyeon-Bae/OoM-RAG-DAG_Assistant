import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/shell/Header";
import { ReportView } from "@/components/blocks/report/ReportView";
import { getLogs } from "@/lib/api";
import { getCurrentUser } from "@/lib/api/session";
import { accessOf } from "@/lib/access";
import { resolveWs } from "@/lib/ws";

// 장애 보고서 R1 (FE-REQ-005). 진입: 타임라인 장애 건의 [보고서]. 하위 기록 id 로 오면 그 장애 건(루트)으로 보낸다.
// 내용은 화면(ReportView)이 백엔드 /reports 로 받는다(#118) — 주소는 장애 건 번호로 두고 보고서 id 는 쓰지 않는다(회신 §3.7 ③)
export default async function ReportPage({ params }: { params: Promise<{ wsId: string; rootId: string }> }) {
  const { rootId: raw } = await params;
  const ws = await resolveWs(params);
  if (!ws.case_enabled) notFound();
  const id = Number(raw);
  const [{ items }, me] = await Promise.all([getLogs(ws.id), getCurrentUser()]);
  const node = items.find((l) => l.id === id);
  if (!node) notFound();
  if (node.root_id !== node.id) redirect(`/w/${ws.id}/reports/${node.root_id}`);
  return (
    <>
      <div className="print:hidden"><Header title="장애 보고서" subtitle="타임라인 기록으로 만든 보고서 — 템플릿 R1" ws={ws} /></div>
      <ReportView wsId={ws.id} rootId={id} canExternal={accessOf(me, ws.id).wsAdmin} />
    </>
  );
}
