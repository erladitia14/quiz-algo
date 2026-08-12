import { NextResponse } from "next/server";
import { listAttempts } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseSlug = searchParams.get("course") || undefined;
  const lessonIdRaw = searchParams.get("lesson") || undefined;
  const lessonId = lessonIdRaw ? Number(lessonIdRaw) : undefined;
  const rows = await listAttempts(
    lessonId && Number.isInteger(lessonId)
      ? { lessonId }
      : courseSlug
        ? { courseSlug }
        : undefined,
  );
  return NextResponse.json({ ok: true, attempts: rows });
}
