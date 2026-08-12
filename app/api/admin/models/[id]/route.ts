import { NextResponse } from "next/server";
import {
  deleteAiModel,
  getAiModel,
  listAiModels,
  updateAiModel,
} from "@/lib/db";
import { testChat } from "@/lib/ai";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/** Update model (edit field, aktif/nonaktifkan, set default). */
export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const modelId = Number(id);
    if (!Number.isInteger(modelId) || modelId <= 0) {
      return NextResponse.json(
        { ok: false, message: "ID model tidak valid." },
        { status: 400 },
      );
    }
    const existing = await getAiModel(modelId);
    if (!existing) {
      return NextResponse.json(
        { ok: false, message: "Model tidak ditemukan." },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      name?: string;
      model_id?: string;
      base_url?: string;
      api_key?: string;
      description?: string;
      enabled?: boolean | number;
      is_default?: boolean | number;
    };

    const updates: Parameters<typeof updateAiModel>[1] = {};
    if (body.name !== undefined) updates.name = String(body.name).trim() || null;
    if (body.model_id !== undefined)
      updates.model_id = String(body.model_id).trim() || null;
    if (body.base_url !== undefined)
      updates.base_url = String(body.base_url).trim();
    if (body.api_key !== undefined) updates.api_key = String(body.api_key).trim();
    if (body.description !== undefined)
      updates.description = String(body.description).trim();
    if (body.enabled !== undefined)
      updates.enabled = body.enabled === false || body.enabled === 0 ? 0 : 1;
    if (body.is_default !== undefined)
      updates.is_default = body.is_default ? 1 : 0;

    await updateAiModel(modelId, updates);
    return NextResponse.json({ ok: true, models: await listAiModels() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui model.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

/** Test koneksi model — kirim prompt kecil ke provider. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const modelId = Number(id);
    const model = await getAiModel(modelId);
    if (!model) {
      return NextResponse.json(
        { ok: false, message: "Model tidak ditemukan." },
        { status: 404 },
      );
    }
    const result = await testChat(model);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menguji model.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

/** Hapus model. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const modelId = Number(id);
    const deleted = await deleteAiModel(modelId);
    if (!deleted) {
      return NextResponse.json(
        { ok: false, message: "Model tidak ditemukan." },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, models: await listAiModels() });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menghapus model.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
