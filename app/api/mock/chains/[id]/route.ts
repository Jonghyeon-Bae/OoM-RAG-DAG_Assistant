import { NextRequest, NextResponse } from "next/server";
import { getChain } from "@/lib/api";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ws = Number(req.headers.get("x-workspace-id") ?? 1);
  const chain = await getChain(ws, Number(id));
  return chain ? NextResponse.json(chain) : NextResponse.json({ message: "no chain" }, { status: 404 });
}
