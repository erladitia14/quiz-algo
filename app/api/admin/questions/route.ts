import { NextResponse } from "next/server";
import { createQuestion, getLesson, listQuestionsAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const course = searchParams.get("course") || "";
  const rows = await listQuestionsAdmin(course || undefined);
  return NextResponse.json({ ok: true, questions: rows });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      course_slug?: string;
      lesson_id?: number;
      question?: string;
      options?: string[];
      correct_index?: number;
      explanation?: string;
      difficulty?: string;
      module_ref?: string;
      lesson_ref?: string;
    };

    const course_slug = body.course_slug || "";
    const question = (body.question || "").trim();
    const options = Array.isArray(body.options)
      ? body.options.map((o) => String(o).trim()).filter(Boolean)
      : [];
    const correct_index = Number(body.correct_index);

    if (!course_slug || !question) {
      return NextResponse.json(
        { ok: false, message: "Course dan pertanyaan wajib diisi." },
        { status: 400 },
      );
    }
    if (options.length < 2) {
      return NextResponse.json(
        { ok: false, message: "Minimal 2 pilihan jawaban." },
        { status: 400 },
      );
    }
    if (
      Number.isNaN(correct_index) ||
      correct_index < 0 ||
      correct_index >= options.length
    ) {
      return NextResponse.json(
        { ok: false, message: "Indeks jawaban benar tidak valid." },
        { status: 400 },
      );
    }

    // Quiz berjalan per lesson — soal wajib punya lesson tujuan.
    const lessonId = Number(body.lesson_id);
    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      return NextResponse.json(
        { ok: false, message: "Pilih lesson tujuan untuk soal ini." },
        { status: 400 },
      );
    }
    const lesson = await getLesson(lessonId);
    if (!lesson || lesson.course_slug !== course_slug) {
      return NextResponse.json(
        { ok: false, message: "Lesson tidak ditemukan pada course tersebut." },
        { status: 400 },
      );
    }

    const id = await createQuestion({
      course_slug,
      lesson_id: lessonId,
      lesson_ref: body.lesson_ref || lesson.title,
      module_ref: body.module_ref || lesson.module_label,
      question,
      options,
      correct_index,
      explanation: body.explanation || "",
      difficulty: body.difficulty || "easy",
    });

    return NextResponse.json({ ok: true, id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menambah soal.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
