import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const questionId = parseInt(id, 10);
    const db = getDb();
    const existing = db
      .prepare("SELECT * FROM questions WHERE id = ?")
      .get(questionId);
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

    db.prepare(
      `UPDATE questions SET
        question = COALESCE(?, question),
        options = COALESCE(?, options),
        correct_index = COALESCE(?, correct_index),
        explanation = COALESCE(?, explanation),
        difficulty = COALESCE(?, difficulty),
        module_ref = COALESCE(?, module_ref),
        lesson_ref = COALESCE(?, lesson_ref),
        active = COALESCE(?, active)
       WHERE id = ?`,
    ).run(
      body.question?.trim() || null,
      options ? JSON.stringify(options) : null,
      correct_index === undefined ? null : correct_index,
      body.explanation !== undefined ? body.explanation : null,
      body.difficulty || null,
      body.module_ref !== undefined ? body.module_ref : null,
      body.lesson_ref !== undefined ? body.lesson_ref : null,
      body.active === undefined ? null : body.active,
      questionId,
    );

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
    const db = getDb();
    const result = db.prepare("DELETE FROM questions WHERE id = ?").run(questionId);
    if (result.changes === 0) {
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
