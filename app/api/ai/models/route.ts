import { NextResponse } from "next/server";
import { listAiModels } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Daftar model AI yang aktif untuk user.
 * api_key tidak pernah dikirim ke client.
 */
export async function GET() {
  const models = await listAiModels(true);
  return NextResponse.json({
    ok: true,
    models: models.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      is_default: m.is_default,
    })),
  });
}
