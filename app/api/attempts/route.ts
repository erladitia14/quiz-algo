import { NextResponse } from "next/server";
import { listAttempts } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const courseSlug = searchParams.get("course") || undefined;
  const rows = listAttempts(courseSlug);
  return NextResponse.json({ ok: true, attempts: rows });
}
