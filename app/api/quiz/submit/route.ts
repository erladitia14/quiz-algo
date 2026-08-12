import { NextResponse } from "next/server";
import {
  getAttemptScore,
  getLesson,
  getQuestionForGrading,
  recordAttempt,
} from "@/lib/db";

type SubmittedAnswer = { questionId?: number; selectedIndex?: number };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      lessonId?: number;
      quizType?: string;
      studentName?: string;
      startedAt?: string;
      answers?: SubmittedAnswer[];
    };

    const lessonId = Number(body.lessonId);
    const quizType = body.quizType === "post" ? "post" : "pre";
    const studentName = (body.studentName || "").trim();
    const startedAt = body.startedAt || new Date().toISOString();
    const answers = Array.isArray(body.answers) ? body.answers : [];

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
    if (!studentName) {
      return NextResponse.json(
        { ok: false, message: "Nama peserta wajib diisi." },
        { status: 400 },
      );
    }
    if (answers.length === 0) {
      return NextResponse.json(
        { ok: false, message: "Belum ada jawaban yang dikirim." },
        { status: 400 },
      );
    }

    // Validasi jawaban terhadap bank soal lesson di server — tidak percaya client.
    const graded: Array<{
      id: number;
      selectedIndex: number;
      isCorrect: boolean;
    }> = [];
    for (const answer of answers) {
      const questionId = Number(answer.questionId);
      const selectedIndex = Number(answer.selectedIndex);
      const question = await getQuestionForGrading(questionId, lessonId);
      if (!question) {
        return NextResponse.json(
          { ok: false, message: `Soal ${questionId} tidak valid untuk lesson ini.` },
          { status: 400 },
        );
      }
      graded.push({
        id: question.id,
        selectedIndex,
        isCorrect: selectedIndex === question.correct_index,
      });
    }

    const attemptId = await recordAttempt({
      studentName,
      courseSlug: lesson.course_slug,
      lessonId,
      quizType,
      questions: graded,
      startedAt,
    });

    const attempt = await getAttemptScore(attemptId);

    return NextResponse.json({
      ok: true,
      attemptId,
      score: attempt?.score ?? 0,
      correctCount: attempt?.correct_count ?? 0,
      totalQuestions: graded.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan quiz.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
