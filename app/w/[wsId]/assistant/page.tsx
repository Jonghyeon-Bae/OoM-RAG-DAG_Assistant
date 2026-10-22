import { Header } from "@/components/shell/Header";
import { Chip } from "@/components/ui";
import { AssistantScreen } from "@/components/blocks/AssistantScreen";
import { getMockAnswer } from "@/lib/api";
import { resolveWs } from "@/lib/ws";

export default async function Page({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await resolveWs(params);
  // 정적 단계: 시나리오 B(02 §3) 질의로 샘플 답변 생성. 훅 단계에서 이 줄과 answer prop 을 제거한다
  const answer = await getMockAnswer(ws.id, "외근할 때 VPN 접속 신청 기준이 어떻게 되나요? 그리고 E-403 오류가 계속 나는데 예전에 어떻게 해결했는지도 알려줘.");
  return (
    <>
      <Header title="AI 어시스턴트" subtitle="공식 규정 근거와 실무 해결 노하우를 한 번에 답변합니다" ws={ws} right={<Chip>형태소 어휘 + 벡터 · RRF</Chip>} />
      <AssistantScreen ws={ws} answer={answer} />
    </>
  );
}