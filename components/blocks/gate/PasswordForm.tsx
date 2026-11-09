"use client";
import { GateFrame } from "./GateFrame";
import { PasswordChange } from "@/components/blocks/account/PasswordChange";

// 비밀번호 변경 게이트 (작업지시 B-2): 첫 로그인·초기화·180일 만료. 본체는 account/PasswordChange (마이페이지와 공용)
export function PasswordForm() {
  return (
    <GateFrame gate="password">
      {(m, done) => (
        <>
          <div>
            <h1 className="text-xl font-bold text-ink">비밀번호 변경</h1>
            <p className="mt-1 text-sm text-ink-muted">{m.password_expires_at && new Date(m.password_expires_at) < new Date() ? "비밀번호 사용 기간이 지났습니다. 새 비밀번호로 바꾼 뒤 계속할 수 있습니다." : "처음 발급받은 비밀번호는 바꾼 뒤에 쓸 수 있습니다."}</p>
          </div>
          <PasswordChange submitLabel="변경하고 계속" onDone={done} autoFocus />
        </>
      )}
    </GateFrame>
  );
}
