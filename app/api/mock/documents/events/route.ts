import { NextRequest, NextResponse } from "next/server";
import { getDocumentEvents } from "@/lib/api";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("document_id");
  const items = await getDocumentEvents(Number(req.headers.get("x-workspace-id") ?? 1), q ? Number(q) : undefined);
  return NextResponse.json(items);
}
