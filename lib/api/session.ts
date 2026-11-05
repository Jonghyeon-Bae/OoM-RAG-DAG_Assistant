// 서버 컴포넌트용 현재 사용자 (Spring GET /me). 로그인 안 돼 있으면 server.ts 가 "/login" 으로 보낸다
// 주의: 경로는 /auth/me 가 아니라 /me (BE-CHECK-001 회신 §0)
import { serverGet, serverPeek } from "@/lib/api/server";
import type { Me } from "@/lib/types/domain";

export async function getCurrentUser(): Promise<Me> {
  return serverGet<Me>("/me");
}

/** 로그인 여부만 본다 — 401 이면 null (redirect 없음). 대문·로그인 화면이 "이미 로그인됐으면 바로 들어가기"에 쓴다 */
export async function peekCurrentUser(): Promise<Me | null> {
  return serverPeek<Me>("/me");
}
