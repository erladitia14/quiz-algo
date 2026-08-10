import { NextResponse } from "next/server";
import { listCourses } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const courses = await listCourses();
  return NextResponse.json({
    ok: true,
    courses: courses.map((c) => ({
      slug: c.slug,
      title: c.title,
      track: c.track,
    })),
  });
}
