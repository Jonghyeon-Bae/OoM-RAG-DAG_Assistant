import { NextRequest, NextResponse } from "next/server";
import { getSession, setSessionScore } from "@/lib/api";

const ws = (req: NextRequest) => Number(req.headers.get("x-workspace-id") ?? 1);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const s = await getSession(ws(req), Number(id));
  return s ? NextResponse.json(s) : NextResponse.json({ message: "not found" }, { status: 404 });
}

// 답변 피드백. 실서버: POST /api/feedback {session_id, score} (answer_feedback INSERT). 목업은 세션 행에 바로 기록
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (![1, -1, null].includes(body?.score)) return NextResponse.json({ message: "score must be 1|-1|null" }, { status: 400 });
  const s = await setSessionScore(ws(req), Number(id), body.score);
  return s ? NextResponse.json(s) : NextResponse.json({ message: "not found" }, { status: 404 });
}
