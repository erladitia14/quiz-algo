/**
 * Router model AI untuk AI tutor.
 *
 * Semua model yang ditambahkan admin lewat /admin/models harus memakai
 * endpoint kompatibel OpenAI Chat Completions (POST {base_url}/chat/completions).
 * Ini mencakup: OpenAI, 9Router gateway, Groq, DeepSeek, OpenRouter,
 * Gemini-compat proxy, Ollama, dll.
 *
 * Jika sebuah model tidak mengisi base_url / api_key, nilai fallback diambil
 * dari environment: AI_BASE_URL dan AI_API_KEY (default: api.openai.com).
 * Dengan begitu cukup isi model_id saja kalau base gateway sudah diset global.
 */
import { getAiModel, listAiModels, type AiModel } from "@/lib/db";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

export function resolveProvider(model: AiModel): {
  baseUrl: string;
  apiKey: string;
} {
  const baseUrl =
    (model.base_url || "").trim() ||
    (process.env.AI_BASE_URL || "").trim() ||
    DEFAULT_BASE_URL;
  const apiKey =
    (model.api_key || "").trim() || (process.env.AI_API_KEY || "").trim();
  return { baseUrl, apiKey };
}

/**
 * Streaming chat completion. Mengembalikan ReadableStream berisi SSE events
 * (`data: {...}`) yang diteruskan apa adanya ke client — client yang parse
 * delta kontennya.
 */
export async function streamChat(params: {
  model: AiModel;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<ReadableStream<Uint8Array>> {
  const { baseUrl, apiKey } = resolveProvider(params.model);

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: params.model.model_id,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      ...(params.maxTokens ? { max_tokens: params.maxTokens } : {}),
      stream: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `Provider AI menolak request (${response.status}): ${detail.slice(0, 300) || response.statusText}`,
    );
  }
  if (!response.body) {
    throw new Error("Provider AI tidak mengembalikan stream.");
  }

  // Teruskan byte dari provider apa adanya — sudah format SSE.
  return response.body;
}

/** Chat non-streaming, untuk tombol "Test koneksi" di admin. */
export async function testChat(model: AiModel): Promise<{
  ok: boolean;
  reply: string;
  error?: string;
}> {
  try {
    const { baseUrl, apiKey } = resolveProvider(model);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: model.model_id,
        messages: [
          {
            role: "user",
            content: "Balas dengan kata: OK",
          },
        ],
        max_tokens: 20,
        stream: false,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        reply: "",
        error: `HTTP ${response.status}: ${detail.slice(0, 300) || response.statusText}`,
      };
    }
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const reply = payload.choices?.[0]?.message?.content?.trim() || "";
    return { ok: reply.length > 0, reply, error: reply ? undefined : "Jawaban kosong dari provider." };
  } catch (error) {
    return {
      ok: false,
      reply: "",
      error: error instanceof Error ? error.message : "Gagal terhubung ke provider.",
    };
  }
}

/** Ambil model enabled berdasarkan id, atau model default jika id kosong. */
export async function resolveEnabledModel(
  modelId?: number | null,
): Promise<AiModel | undefined> {
  if (modelId) {
    const model = await getAiModel(modelId);
    if (model && model.enabled === 1) return model;
    return undefined;
  }
  const enabled = await listAiModels(true);
  return enabled[0]; // is_default DESC — yang pertama adalah default
}
