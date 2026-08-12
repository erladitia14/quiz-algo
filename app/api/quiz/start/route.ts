import { NextResponse } from "next/server";
import {
  getLesson,
  getSettings,
  pickQuestionsForLesson,
} from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lessonId?: number;
      type?: string;
    };
    const lessonId = Number(body.lessonId);
    const type = body.type === "post" ? "post" : "pre";

    if (!Number.isInteger(lessonId) || lessonId <= 0) {
      return NextResponse.json(
        { ok: false, message: "Lesson tidak valid." },
        { status: 400 },
      );
    }

    const lesson = await getLesson(lessonId);
    if (!lesson) {
      return NextResponse.json(
        { ok: false, message: "Lesson tidak ditemukan." },
        { status: 404 },
      );
    }

    const settings = await getSettings();
    const questions = await pickQuestionsForLesson(lessonId);
    if (questions.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Bank soal untuk lesson ini masih kosong." },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      course: { slug: lesson.course_slug },
      lesson: {
        id: lesson.id,
        lesson_number: lesson.lesson_number,
        title: lesson.title,
        module_label: lesson.module_label,
        module_name: lesson.module_name,
      },
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
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memulai quiz.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
