import { NextRequest, NextResponse } from "next/server";
import { createLog } from "@/lib/api";

export async function POST(req: NextRequest) {
  const ws = Number(req.headers.get("x-workspace-id") ?? 1);
  const body = await req.json();
  if (!body?.title || !body?.body || !body?.type) return NextResponse.json({ message: "title, body, type required" }, { status: 400 });
  const node = await createLog(ws, { type: body.type, title: body.title, body: body.body, parent_id: body.parent_id ?? null });
  return NextResponse.json(node, { status: 201 });
}
