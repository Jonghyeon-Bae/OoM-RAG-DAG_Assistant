import { NextRequest, NextResponse } from "next/server";
import { refineLog } from "@/lib/api";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = await refineLog(Number(req.headers.get("x-workspace-id") ?? 1), Number(id));
  return n ? NextResponse.json(n, { status: 202 }) : NextResponse.json({ message: "not found" }, { status: 404 });
}
