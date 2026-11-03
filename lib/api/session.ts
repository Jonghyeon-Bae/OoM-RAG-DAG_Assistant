// 서버 컴포넌트용 현재 사용자 (Spring GET /me). 로그인 안 돼 있으면 server.ts 가 "/" 로 보낸다
// 주의: 경로는 /auth/me 가 아니라 /me (BE-CHECK-001 회신 §0)
import { serverGet } from "@/lib/api/server";
import type { Me } from "@/lib/types/domain";

export async function getCurrentUser(): Promise<Me> {
  return serverGet<Me>("/me");
}
