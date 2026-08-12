import { NextResponse } from "next/server";
import {
  getLessonQuestionCounts,
  listCourses,
  listLessons,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeLessons = searchParams.get("includeLessons") === "1";
  const courses = await listCourses();

  if (!includeLessons) {
    return NextResponse.json({
      ok: true,
      courses: courses.map((c) => ({
        slug: c.slug,
        title: c.title,
        track: c.track,
      })),
    });
  }

  const result = await Promise.all(
    courses.map(async (c) => {
      const lessons = await listLessons(c.slug);
      const counts = await getLessonQuestionCounts(c.slug);
      return {
        slug: c.slug,
        title: c.title,
        track: c.track,
        lessons: lessons
          .map((l) => ({
            id: l.id,
            lesson_number: l.lesson_number,
            module_label: l.module_label,
            module_name: l.module_name,
            title: l.title,
            question_count: counts.get(l.id) || 0,
          }))
          .filter((l) => l.question_count > 0),
      };
    }),
  );

  return NextResponse.json({ ok: true, courses: result });
}
