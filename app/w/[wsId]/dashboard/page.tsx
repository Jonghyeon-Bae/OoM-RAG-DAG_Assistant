import { Header } from "@/components/shell/Header";
import { resolveWs } from "@/lib/ws";

export default async function Page({ params }: { params: Promise<{ wsId: string }> }) {
  const ws = await resolveWs(params);
  return (
    <>
      <Header title="성과 대시보드" subtitle="FE-002 순서에 따라 다음에 구성" ws={ws} />
      <main className="p-8 text-sm text-ink-muted">성과 대시보드 화면 작성 예정.</main>
    </>
  );
}
