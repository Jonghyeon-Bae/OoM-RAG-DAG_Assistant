import { NextRequest } from "next/server";
import { mockChatEvents } from "@/lib/api";

// 가짜 Spring 릴레이. 이벤트 생성은 lib/api/index.ts, 여기선 text/event-stream 으로 흘리기만.
export async function POST(req: NextRequest) {
  const ws = Number(req.headers.get("x-workspace-id") ?? 1);
  const { query = "" } = (await req.json()) as { query?: string };
  const enc = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const e of mockChatEvents(ws, query)) {
          if (req.signal.aborted) break;                                   // 브라우저가 중지 누름
          controller.enqueue(enc.encode(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`));
        }
      } catch (err) {
        controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ message: err instanceof Error ? err.message : "stream error" })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}