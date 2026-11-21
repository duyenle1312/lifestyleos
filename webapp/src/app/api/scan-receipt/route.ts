// Receipt scanning, server side so the Gemini key never reaches the browser.
// iOS: Vision OCR → Gemini (Firebase AI Logic). Web: the image goes straight to Gemini (it is multimodal).
import { createClient } from "@supabase/supabase-js";
import { parseReceiptResponse, RECEIPT_PROMPT } from "@/lib/receipt";

const MAX_BASE64_LENGTH = 6_000_000; // ~4.5 MB image

export async function POST(request: Request) {
  // Only signed-in users of this Supabase project may spend Gemini quota.
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return Response.json({ error: "Not signed in" }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: auth, error: authError } = await supabase.auth.getUser(token);
  if (authError || !auth.user) return Response.json({ error: "Not signed in" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY is not configured on the server" }, { status: 500 });
  }

  const body = (await request.json().catch(() => null)) as { image?: string; mimeType?: string } | null;
  if (!body?.image || !body.mimeType?.startsWith("image/")) {
    return Response.json({ error: "Invalid image format" }, { status: 400 });
  }
  if (body.image.length > MAX_BASE64_LENGTH) {
    return Response.json({ error: "Image is too large" }, { status: 413 });
  }

  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: RECEIPT_PROMPT }, { inline_data: { mime_type: body.mimeType, data: body.image } }],
        },
      ],
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = json?.error?.message ?? `Gemini request failed (${res.status})`;
    return Response.json({ error: `API error: ${message}` }, { status: 502 });
  }

  const text: string | undefined = json?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("");
  if (!text) return Response.json({ error: "Invalid API response format" }, { status: 502 });

  return Response.json(parseReceiptResponse(text));
}
