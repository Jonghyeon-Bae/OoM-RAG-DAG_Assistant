// 데모 세션: 로그인 화면에서 고른 사용자를 쿠키 oom_u 로 전달. 실서버는 JWT(Spring)로 교체 (ROADMAP 전환 체크리스트 3)
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import usersSeed from "@/mocks/users.json";
import type { User } from "@/lib/types/domain";

export const SESSION_COOKIE = "oom_u";
const users = usersSeed as User[];

export function userById(id: number | string | undefined | null): User {
  return users.find((u) => u.id === Number(id)) ?? users[0];
}

// 서버 컴포넌트용 (cookies()는 동적 → Suspense 안에서 호출)
export async function getCurrentUser(): Promise<User> {
  const c = await cookies();
  return userById(c.get(SESSION_COOKIE)?.value);
}

// 목업 라우트 핸들러용
export function actorFromRequest(req: NextRequest): User {
  return userById(req.cookies.get(SESSION_COOKIE)?.value);
}
