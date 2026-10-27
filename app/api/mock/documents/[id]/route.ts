import { NextRequest, NextResponse } from "next/server";
import { deleteDocument, setDocumentStatus } from "@/lib/api";
import { actorFromRequest } from "@/lib/api/session";

const ws = (req: NextRequest) => Number(req.headers.get("x-workspace-id") ?? 1);
// 실서버는 세션(JWT)에서 actor를 얻는다. 목업은 데모 쿠키
const actor = (req: NextRequest) => actorFromRequest(req).name;

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (body?.status !== "active" && body?.status !== "retired") return NextResponse.json({ message: "status must be active|retired" }, { status: 400 });
  if (body.status === "retired" && !body.reason) return NextResponse.json({ message: "폐기 사유가 필요합니다" }, { status: 400 });
  const d = await setDocumentStatus(ws(req), Number(id), body.status, actor(req), body.reason);
  return d ? NextResponse.json(d) : NextResponse.json({ message: "not found" }, { status: 404 });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const r = await deleteDocument(ws(req), Number(id), actor(req));
  if (r === "ok") return new NextResponse(null, { status: 204 });
  if (r === "not_retired") return NextResponse.json({ message: "폐기 상태의 문서만 삭제할 수 있습니다" }, { status: 409 });
  return NextResponse.json({ message: "not found" }, { status: 404 });
}
