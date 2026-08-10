import { NextResponse } from "next/server";
import {
  getAttemptScore,
  getCourse,
  getQuestionForGrading,
  recordAttempt,
} from "@/lib/db";

type SubmittedAnswer = { questionId?: number; selectedIndex?: number };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      courseSlug?: string;
      quizType?: string;
      studentName?: string;
      startedAt?: string;
      answers?: SubmittedAnswer[];
    };

    const courseSlug = body.courseSlug || "";
    const quizType = body.quizType === "post" ? "post" : "pre";
    const studentName = (body.studentName || "").trim();
    const startedAt = body.startedAt || new Date().toISOString();
    const answers = Array.isArray(body.answers) ? body.answers : [];

    if (!(await getCourse(courseSlug))) {
      return NextResponse.json(
        { ok: false, message: "Course tidak ditemukan." },
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

    // Validasi jawaban terhadap bank soal di server — tidak percaya client.
    const graded: Array<{
      id: number;
      selectedIndex: number;
      isCorrect: boolean;
    }> = [];
    for (const answer of answers) {
      const questionId = Number(answer.questionId);
      const selectedIndex = Number(answer.selectedIndex);
      const question = await getQuestionForGrading(questionId, courseSlug);
      if (!question) {
        return NextResponse.json(
          { ok: false, message: `Soal ${questionId} tidak valid.` },
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
      courseSlug,
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
