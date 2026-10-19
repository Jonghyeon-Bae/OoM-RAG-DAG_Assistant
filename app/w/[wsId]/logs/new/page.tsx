import { Header } from "@/components/shell/Header";
import { Chip } from "@/components/ui";
import { RegisterScreen } from "@/components/blocks/RegisterScreen";
import { getLogs, getRecentLogs, getWeeklyCount } from "@/lib/api";
import { resolveWs } from "@/lib/ws";

export default async function NewLogPage({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await resolveWs(params);
  const [recent, weekly, { items }] = await Promise.all([getRecentLogs(ws.id, 8), getWeeklyCount(ws.id), getLogs(ws.id)]);
  return (
    <>
      <Header title="업무로그 등록" subtitle="성공/실패/참고 로그를 등록하면 AI가 자동 정제·인덱싱합니다" ws={ws} right={<Chip>이번 주 등록 {weekly}건</Chip>} />
      <RegisterScreen wsId={ws.id} candidates={items} initialRecent={recent} />
    </>
  );
}
