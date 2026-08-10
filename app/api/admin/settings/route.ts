import { NextResponse } from "next/server";
import { getSettings, setSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, settings: await getSettings() });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, string>;
    const allowed = [
      "quiz_question_count",
      "quiz_pass_threshold",
      "quiz_timer_minutes",
    ];
    for (const key of allowed) {
      if (body[key] !== undefined) {
        const value = String(body[key]).trim();
        if (value === "" || Number.isNaN(Number(value))) {
          return NextResponse.json(
            { ok: false, message: `Nilai ${key} harus angka.` },
            { status: 400 },
          );
        }
        await setSetting(key, value);
      }
    }
    return NextResponse.json({ ok: true, settings: await getSettings() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan pengaturan.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
