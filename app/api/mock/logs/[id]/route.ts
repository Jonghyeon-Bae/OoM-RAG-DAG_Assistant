import { NextRequest, NextResponse } from "next/server";
import { getLog, setLogStatus, setResolved, orphanedBy } from "@/lib/api";

const ws = (req: NextRequest) => Number(req.headers.get("x-workspace-id") ?? 1);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = await getLog(ws(req), Number(id));
  return n ? NextResponse.json(n) : NextResponse.json({ message: "not found" }, { status: 404 });
}

// 폐기 시 함께 폐기될 자손 미리보기
export async function OPTIONS(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return NextResponse.json({ orphaned: orphanedBy(Number(id)) });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (typeof body?.resolved === "boolean") {
    const n = await setResolved(ws(req), Number(id), body.resolved, body.note);
    if (!n) return NextResponse.json({ message: "not found" }, { status: 404 });
    if (n === "NOT_ROOT") return NextResponse.json({ code: n, message: "장애 건(첫 기록)만 완료 처리할 수 있습니다" }, { status: 409 });
    if (n === "REF_ROOT") return NextResponse.json({ code: n, message: "참고 자료는 완료 처리 대상이 아닙니다" }, { status: 409 });
    if (n === "NOTE_REQUIRED") return NextResponse.json({ code: n, message: "이어진 해결(성공) 로그가 없습니다. 완료 사유를 적어 주세요" }, { status: 409 });
    return NextResponse.json(n);
  }
  if (body?.status !== "active" && body?.status !== "deprecated") return NextResponse.json({ message: "status must be active|deprecated" }, { status: 400 });
  if (body.status === "deprecated" && !String(body.reason ?? "").trim()) return NextResponse.json({ message: "폐기 사유가 필요합니다" }, { status: 400 });
  const r = await setLogStatus(ws(req), Number(id), body.status, !!body.cascade, body.reason);
  return r ? NextResponse.json({ ...r.node, affected: r.affected }) : NextResponse.json({ message: "not found" }, { status: 404 });
}
