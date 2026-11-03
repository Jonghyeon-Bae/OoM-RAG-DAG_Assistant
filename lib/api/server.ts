// 서버 컴포넌트 전용. 브라우저가 보낸 로그인 쿠키(OOMSESSION)를 Spring 에 그대로 전달한다.
// 서버 컴포넌트는 Node 에서 돌아 브라우저 쿠키가 자동으로 붙지 않는다 → Cookie 헤더로 직접 실어야 401 이 안 난다 (작업지시 C-2)
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8080";

async function call(path: string, wsId?: number): Promise<Response> {
  const jar = await cookies();
  const res = await fetch(`${ORIGIN}/api/v1${path}`, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      Cookie: jar.toString(),
      ...(wsId ? { "X-Workspace-Id": String(wsId) } : {}),
    },
  });
  if (res.status === 401) redirect("/"); // 로그인 없음 → 첫 화면
  return res;
}

export async function serverGet<T>(path: string, wsId?: number): Promise<T> {
  const res = await call(path, wsId);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return (await res.json()) as T;
}

// 404 를 "없음"으로 돌려받는 버전 (체인 조회 등)
export async function serverGetOrNull<T>(path: string, wsId?: number): Promise<T | null> {
  const res = await call(path, wsId);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return (await res.json()) as T;
}
