import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { LoginForm } from "@/components/blocks/LoginForm";
import { peekCurrentUser } from "@/lib/api/session";
import { nextPathFor } from "@/lib/api/auth";

// 로그인 (작업지시 B-1). 이미 로그인된 사용자는 HTML 을 내기 전에 서버에서 바로 보낸다 — 점멸 없음
export default async function LoginPage() {
  const me = await peekCurrentUser();
  if (me) redirect(nextPathFor(me));
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 md:p-10">
        <Link href="/" className="mb-6 flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary-700 font-bold text-white">O</span>
          <span className="text-2xl font-bold text-ink">OoM Assist</span>
        </Link>
        <h1 className="mb-1 text-lg font-semibold text-ink">로그인</h1>
        <p className="mb-6 text-sm text-ink-muted">사번과 비밀번호로 들어갑니다.</p>
        <LoginForm />
        <p className="mt-6 text-xs text-ink-muted">첫 로그인은 개인정보 처리 동의와 비밀번호 변경 뒤에 시작됩니다. 비밀번호를 여러 번 틀리면 잠시 잠깁니다.</p>
      </Card>
    </main>
  );
}
