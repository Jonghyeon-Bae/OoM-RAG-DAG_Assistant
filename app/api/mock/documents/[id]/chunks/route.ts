import { NextRequest, NextResponse } from "next/server";
import { getDocumentChunks } from "@/lib/api";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const c = await getDocumentChunks(Number(req.headers.get("x-workspace-id") ?? 1), Number(id));
  return c ? NextResponse.json(c) : NextResponse.json({ message: "not found" }, { status: 404 });
}
