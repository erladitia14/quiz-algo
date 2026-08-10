import { NextResponse } from "next/server";
import { getCourse, getSettings, pickRandomQuestions } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      courseSlug?: string;
      type?: string;
    };
    const courseSlug = body.courseSlug || "";
    const type = body.type === "post" ? "post" : "pre";

    const course = await getCourse(courseSlug);
    if (!course) {
      return NextResponse.json(
        { ok: false, message: "Course tidak ditemukan." },
        { status: 404 },
      );
    }

    const settings = await getSettings();
    const count = Math.max(
      1,
      parseInt(settings.quiz_question_count || "10", 10) || 10,
    );
    const questions = await pickRandomQuestions(courseSlug, count);
    if (questions.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Bank soal untuk course ini masih kosong." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      course: { slug: course.slug, title: course.title },
      type,
      passThreshold: parseInt(settings.quiz_pass_threshold || "70", 10),
      timerMinutes:
        type === "post"
          ? parseInt(settings.quiz_timer_minutes || "20", 10)
          : 0,
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        module_ref: q.module_ref,
        lesson_ref: q.lesson_ref,
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memulai quiz.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
