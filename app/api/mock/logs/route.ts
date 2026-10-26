import { NextRequest, NextResponse } from "next/server";
import { createLog, getLogs } from "@/lib/api";

export async function GET(req: NextRequest) {
  const ws = Number(req.headers.get("x-workspace-id") ?? 1);
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 8);
  const { items } = await getLogs(ws);
  return NextResponse.json(items.slice(0, limit));
}

export async function POST(req: NextRequest) {
  const ws = Number(req.headers.get("x-workspace-id") ?? 1);
  const body = await req.json();
  if (!body?.title || !body?.body || !body?.type) return NextResponse.json({ message: "title, body, type required" }, { status: 400 });
  try {
    const node = await createLog(ws, { type: body.type, title: body.title, body: body.body, parent_id: body.parent_id ?? null, resolve_root: !!body.resolve_root });
    return NextResponse.json(node, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    if (msg === "PARENT_NOT_FOUND") return NextResponse.json({ message: "상위 로그가 이 워크스페이스에 없습니다" }, { status: 409 });
    if (msg === "PARENT_DEPRECATED") return NextResponse.json({ message: "폐기된 로그 아래에는 등록할 수 없습니다" }, { status: 409 });
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
