import { Card } from "@/components/ui/card";

// 첫 로그인 게이트(동의 → 비밀번호 변경) 공용 셸. 사이드바 없음 — 통과 전엔 다른 화면으로 갈 수 없다
export default function GateLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-xl p-8 md:p-10">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-primary-700 text-sm font-bold text-white">O</span>
          <span className="font-semibold text-ink">OoM Assist</span>
        </div>
        {children}
      </Card>
    </main>
  );
}
