import { NextResponse } from "next/server";
import { getAttempt, getAttemptAnswers } from "@/lib/db";
import { resolveEnabledModel, streamChat, type ChatMessage } from "@/lib/ai";

export const dynamic = "force-dynamic";
// Streaming panjang — jangan dipotong oleh limit default.
export const maxDuration = 60;

const MAX_MESSAGES = 40;
const MAX_CHARS_PER_MESSAGE = 8000;

type IncomingMessage = { role?: string; content?: string };

/**
 * POST /api/ai/chat
 * Body: { modelId?: number, messages: [{role, content}], attemptId?: number }
 * Jika attemptId disertakan, konteks quiz (lesson, nilai, soal yang salah)
 * ikut dikirim agar tutor bisa membahas jawaban peserta.
 *
 * Response: stream SSE dari provider (diteruskan apa adanya).
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      modelId?: number;
      messages?: IncomingMessage[];
      attemptId?: number;
    };

    const incoming = Array.isArray(body.messages) ? body.messages : [];
    if (incoming.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Pesan kosong." },
        { status: 400 },
      );
    }

    // Sanitasi & batas ukuran pesan dari client.
    const messages: ChatMessage[] = incoming.slice(-MAX_MESSAGES).map((m) => {
      const role =
        m.role === "assistant" || m.role === "system" ? m.role : "user";
      const content = String(m.content || "").slice(0, MAX_CHARS_PER_MESSAGE);
      return { role, content } as ChatMessage;
    });
    if (!messages.some((m) => m.role === "user" && m.content.trim())) {
      return NextResponse.json(
        { ok: false, message: "Pesan kosong." },
        { status: 400 },
      );
    }

    const model = await resolveEnabledModel(
      typeof body.modelId === "number" ? body.modelId : null,
    );
    if (!model) {
      return NextResponse.json(
        {
          ok: false,
          message:
            "Model AI tidak tersedia. Hubungi admin untuk mengaktifkan model di panel admin.",
        },
        { status: 404 },
      );
    }

    // Konteks quiz opsional dari attempt yang valid.
    let contextBlock = "";
    if (typeof body.attemptId === "number" && Number.isInteger(body.attemptId)) {
      const attempt = await getAttempt(body.attemptId);
      if (attempt) {
        const answers = await getAttemptAnswers(attempt.id);
        const wrong = answers.filter((a) => a.is_correct === 0);
        contextBlock =
          `\n\nKONTEKS QUIZ PESERTA INI:\n` +
          `- Lesson: ${attempt.lesson_title || attempt.course_slug} (${attempt.quiz_type === "pre" ? "pre-test" : "post-test"})\n` +
          `- Nilai: ${attempt.score} (benar ${attempt.correct_count}/${attempt.total_questions})\n`;
        if (wrong.length > 0) {
          contextBlock += `\nSoal yang dijawab SALAH:\n`;
          for (const a of wrong.slice(0, 15)) {
            const options = JSON.parse(a.options) as string[];
            contextBlock += `- ${a.question} (jawaban benar: ${options[a.correct_index] ?? "?"})\n`;
          }
        }
      }
    }

    const systemPrompt: ChatMessage = {
      role: "system",
      content:
        "Kamu adalah tutor AI ramah di platform Quiz-Algo, tempat belajar Python, Visual Programming, dan algoritma untuk siswa. " +
        "Jawab dalam Bahasa Indonesia yang santai tapi jelas. Fokus membantu peserta memahami materi dan soal quiz mereka: " +
        "jelaskan konsep, bahas soal yang salah tanpa sekadar memberi kunci jawaban, dan beri contoh kode pendek bila relevan. " +
        "Jika ditanya di luar topik belajar, tetap arahkan kembali dengan sopan." +
        contextBlock,
    };

    const stream = await streamChat({
      model,
      messages: [systemPrompt, ...messages],
      temperature: 0.6,
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
        "X-Model-Name": model.name,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memproses chat.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
