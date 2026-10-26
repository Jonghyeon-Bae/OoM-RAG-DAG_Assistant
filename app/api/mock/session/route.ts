import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, userById } from "@/lib/api/session";

// GET /api/mock/session?u=3&next=/w/2/assistant → 쿠키 설정 후 이동 (데모 로그인)
export async function GET(req: NextRequest) {
  const u = userById(req.nextUrl.searchParams.get("u"));
  const next = req.nextUrl.searchParams.get("next") ?? "/";
  const res = NextResponse.redirect(new URL(next.startsWith("/") ? next : "/", req.url));
  res.cookies.set(SESSION_COOKIE, String(u.id), { path: "/", sameSite: "lax" });
  return res;
}
