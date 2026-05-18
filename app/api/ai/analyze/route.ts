import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import type { AnalyzeRequest } from "@/types";

export async function POST(request: NextRequest): Promise<Response> {
  // Authenticate before touching the AI API — Claude calls cost money
  const token = request.cookies.get("shipstream_token")?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    verifyToken(token);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body: AnalyzeRequest = await request.json();
  const { events } = body;

  if (!events || events.length === 0) {
    return NextResponse.json(
      { error: "No events provided for analysis" },
      { status: 400 }
    );
  }

  // Dynamically import claude to avoid crashing the module at startup when the
  // API key isn't configured
  const { streamOperationalSummary } = await import("@/lib/claude");

  try {
    const textStream = await streamOperationalSummary(events);

    // Pipe the Anthropic SDK stream through a TransformStream to produce
    // a streaming HTTP response — text appears word-by-word on the client
    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of textStream) {
            // Each chunk may be a MessageStreamEvent — extract text delta
            const chunkAny = chunk as unknown as Record<string, unknown>;
            if (
              chunkAny.type === "content_block_delta" &&
              chunkAny.delta &&
              (chunkAny.delta as Record<string, unknown>).type === "text_delta"
            ) {
              const text = (chunkAny.delta as Record<string, unknown>).text as string;
              controller.enqueue(encoder.encode(text));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // Transfer-Encoding: chunked is implicit when body is a stream
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "AI analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
