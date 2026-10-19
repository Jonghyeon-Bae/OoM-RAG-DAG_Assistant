import { NextRequest, NextResponse } from "next/server";
import { getLog, setLogStatus } from "@/lib/api";

const ws = (req: NextRequest) => Number(req.headers.get("x-workspace-id") ?? 1);

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = await getLog(ws(req), Number(id));
  return n ? NextResponse.json(n) : NextResponse.json({ message: "not found" }, { status: 404 });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json();
  if (body?.status !== "active" && body?.status !== "deprecated") return NextResponse.json({ message: "status must be active|deprecated" }, { status: 400 });
  if (body.status === "deprecated" && !body.reason) return NextResponse.json({ message: "reason required" }, { status: 400 });
  const n = await setLogStatus(ws(req), Number(id), body.status);
  return n ? NextResponse.json(n) : NextResponse.json({ message: "not found" }, { status: 404 });
}
