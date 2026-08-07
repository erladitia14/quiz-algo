import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const course = searchParams.get("course") || "";
  const db = getDb();
  const rows = course
    ? db
        .prepare(
          "SELECT * FROM questions WHERE course_slug = ? ORDER BY module_ref, lesson_ref, id",
        )
        .all(course)
    : db
        .prepare("SELECT * FROM questions ORDER BY course_slug, module_ref, lesson_ref, id")
        .all();
  return NextResponse.json({ ok: true, questions: rows });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      course_slug?: string;
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

    const db = getDb();
    const result = db
      .prepare(
        `INSERT INTO questions (course_slug, lesson_ref, module_ref, question, options, correct_index, explanation, difficulty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        course_slug,
        body.lesson_ref || "",
        body.module_ref || "",
        question,
        JSON.stringify(options),
        correct_index,
        body.explanation || "",
        body.difficulty || "easy",
      );

    return NextResponse.json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menambah soal.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
