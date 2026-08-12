import { NextResponse } from "next/server";
import { createAiModel, listAiModels } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Daftar semua model AI (untuk admin). */
export async function GET() {
  const models = await listAiModels();
  return NextResponse.json({ ok: true, models });
}

/** Tambah model AI baru. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      model_id?: string;
      base_url?: string;
      api_key?: string;
      description?: string;
      enabled?: boolean | number;
      is_default?: boolean | number;
    };

    const name = (body.name || "").trim();
    const modelId = (body.model_id || "").trim();
    if (!name) {
      return NextResponse.json(
        { ok: false, message: "Nama tampilan wajib diisi." },
        { status: 400 },
      );
    }
    if (!modelId) {
      return NextResponse.json(
        { ok: false, message: "Model ID wajib diisi (contoh: gpt-4o-mini)." },
        { status: 400 },
      );
    }
    const baseUrl = (body.base_url || "").trim() || undefined;
    if (baseUrl) {
      try {
        const parsed = new URL(baseUrl);
        if (!/^https?:$/.test(parsed.protocol)) throw new Error();
      } catch {
        return NextResponse.json(
          { ok: false, message: "Base URL harus http(s) yang valid." },
          { status: 400 },
        );
      }
    }

    const id = await createAiModel({
      name,
      model_id: modelId,
      base_url: baseUrl,
      api_key: (body.api_key || "").trim(),
      description: (body.description || "").trim(),
      enabled: body.enabled === false || body.enabled === 0 ? 0 : 1,
      is_default: body.is_default ? 1 : 0,
    });

    return NextResponse.json({ ok: true, id, models: await listAiModels() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menambahkan model.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
