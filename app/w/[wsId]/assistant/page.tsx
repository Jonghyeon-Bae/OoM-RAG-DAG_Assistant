import { Header } from "@/components/shell/Header";
import { AssistantScreen } from "@/components/blocks/AssistantScreen";
import { resolveWs } from "@/lib/ws";

export default async function Page({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await resolveWs(params);
  return (
    <>
      <Header title="AI 어시스턴트" subtitle="공식 규정 근거와 실무 해결 노하우를 한 번에 답변합니다" ws={ws} />
      <AssistantScreen key={ws.id} ws={ws} />
    </>
  );
}