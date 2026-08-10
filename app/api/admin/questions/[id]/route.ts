import { NextResponse } from "next/server";
import { deleteQuestion, getQuestion, updateQuestion } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const questionId = parseInt(id, 10);
    const existing = await getQuestion(questionId);
    if (!existing) {
      return NextResponse.json(
        { ok: false, message: "Soal tidak ditemukan." },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      question?: string;
      options?: string[];
      correct_index?: number;
      explanation?: string;
      difficulty?: string;
      module_ref?: string;
      lesson_ref?: string;
      active?: number;
    };

    const options = Array.isArray(body.options)
      ? body.options.map((o) => String(o).trim()).filter(Boolean)
      : undefined;
    const correct_index =
      body.correct_index !== undefined ? Number(body.correct_index) : undefined;

    if (options && options.length < 2) {
      return NextResponse.json(
        { ok: false, message: "Minimal 2 pilihan jawaban." },
        { status: 400 },
      );
    }
    if (
      options &&
      correct_index !== undefined &&
      (Number.isNaN(correct_index) ||
        correct_index < 0 ||
        correct_index >= options.length)
    ) {
      return NextResponse.json(
        { ok: false, message: "Indeks jawaban benar tidak valid." },
        { status: 400 },
      );
    }

    await updateQuestion(questionId, {
      question: body.question?.trim() || null,
      options: options || null,
      correct_index: correct_index === undefined ? null : correct_index,
      explanation: body.explanation !== undefined ? body.explanation : null,
      difficulty: body.difficulty || null,
      module_ref: body.module_ref !== undefined ? body.module_ref : null,
      lesson_ref: body.lesson_ref !== undefined ? body.lesson_ref : null,
      active: body.active === undefined ? null : body.active,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui soal.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const questionId = parseInt(id, 10);
    const deleted = await deleteQuestion(questionId);
    if (!deleted) {
      return NextResponse.json(
        { ok: false, message: "Soal tidak ditemukan." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menghapus soal.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
