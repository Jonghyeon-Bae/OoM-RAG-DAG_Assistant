import { Header } from "@/components/shell/Header";
import { getWs } from "@/lib/ws";

export default async function Page({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await getWs(params);
  return (
    <>
      <Header title="규정 문서 관리" subtitle="1단계 정적 화면 — 작성 예정" wsName={ws.name} policyEnabled={ws.policy_enabled} />
      <main className="p-8 text-ink-muted text-sm">규정 문서 관리 화면은 FE-002 순서에 따라 다음에 구성합니다.</main>
    </>
  );
}
