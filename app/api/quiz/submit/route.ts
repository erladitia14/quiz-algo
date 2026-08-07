import { NextResponse } from "next/server";
import { getDb, getCourse, recordAttempt } from "@/lib/db";

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

    if (!getCourse(courseSlug)) {
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
    const db = getDb();
    const getQuestion = db.prepare(
      "SELECT id, correct_index, explanation FROM questions WHERE id = ? AND course_slug = ?",
    );

    const graded: Array<{
      id: number;
      selectedIndex: number;
      isCorrect: boolean;
    }> = [];
    for (const answer of answers) {
      const questionId = Number(answer.questionId);
      const selectedIndex = Number(answer.selectedIndex);
      const question = getQuestion.get(questionId, courseSlug) as
        | { id: number; correct_index: number; explanation: string }
        | undefined;
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

    const attemptId = recordAttempt({
      studentName,
      courseSlug,
      quizType,
      questions: graded,
      startedAt,
    });

    const attempt = db
      .prepare("SELECT * FROM quiz_attempts WHERE id = ?")
      .get(attemptId) as { score: number; correct_count: number };

    return NextResponse.json({
      ok: true,
      attemptId,
      score: attempt.score,
      correctCount: attempt.correct_count,
      totalQuestions: graded.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan quiz.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
