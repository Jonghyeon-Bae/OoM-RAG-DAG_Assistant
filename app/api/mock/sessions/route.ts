import { NextRequest, NextResponse } from "next/server";
import { getSessions } from "@/lib/api";

// 검색 내역 목록. 실서버: GET /api/sessions?limit= (search_sessions + answer_feedback 조인, 본인 워크스페이스)
export async function GET(req: NextRequest) {
  const ws = Number(req.headers.get("x-workspace-id") ?? 1);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 30);
  return NextResponse.json(await getSessions(ws, limit));
}
