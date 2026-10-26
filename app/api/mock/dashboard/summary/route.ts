import { NextRequest, NextResponse } from "next/server";
import { getDashboardSummary } from "@/lib/api";

export async function GET(req: NextRequest) {
  return NextResponse.json(await getDashboardSummary(Number(req.headers.get("x-workspace-id") ?? 1)));
}
