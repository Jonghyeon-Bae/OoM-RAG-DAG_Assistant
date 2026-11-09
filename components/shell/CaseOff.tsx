import Link from "next/link";
import { Card } from "@/components/ui/card";
import { caseOffNotice } from "@/lib/mode";

// 사례를 쓰지 않는 워크스페이스에서 타임라인·등록 URL 을 직접 열었을 때 (메뉴는 비활성이지만 링크·북마크로 올 수 있다)
export function CaseOff({ wsId }: { wsId: number }) {
  return (
    <main className="flex flex-1 items-start justify-center p-6 md:p-10">
      <Card className="w-full max-w-lg p-8">
        <h2 className="text-lg font-semibold text-ink">해결 사례를 쓰지 않는 워크스페이스</h2>
        <p className="mt-2 text-sm text-ink-muted">{caseOffNotice}</p>
        <Link href={`/w/${wsId}/assistant`} className="mt-5 inline-flex h-10 items-center rounded-lg bg-primary-700 px-4 text-sm font-semibold text-white hover:bg-primary-800">AI 어시스턴트로 가기</Link>
      </Card>
    </main>
  );
}
