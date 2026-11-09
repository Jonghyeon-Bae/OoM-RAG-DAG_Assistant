import { connection } from "next/server";

// 요청 시점 기준 남은 일수. 렌더 중 Date.now() 를 직접 부르지 않도록 async 헬퍼로 둔다 (React Compiler 순수성 규칙, #046 과 같은 이유)
export async function daysUntil(iso: string): Promise<number> {
  await connection();
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}
