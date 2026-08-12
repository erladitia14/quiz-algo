"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type AiModelOption = {
  id: number;
  name: string;
  description: string;
  is_default: number;
};

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
};

/**
 * Widget AI tutor untuk peserta.
 *
 * Daftar model di dropdown diambil dari /api/ai/models — otomatis mengikuti
 * model yang diaktifkan admin di /admin/models. Kalau belum ada model aktif,
 * widget tidak ditampilkan sama sekali.
 */
export default function AiTutor({ attemptId }: { attemptId: number }) {
  const [models, setModels] = useState<AiModelOption[]>([]);
  const [modelId, setModelId] = useState<number | null>(null);
  const [open, setOpen] = useState(false);

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ai/models")
      .then((r) => r.json())
      .then((payload) => {
        if (cancelled) return;
        const list = (payload.models || []) as AiModelOption[];
        setModels(list);
        const def = list.find((m) => m.is_default === 1) || list[0];
        if (def) setModelId(def.id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError("");
    setSending(true);
    const history: ChatMsg[] = [...messages, { role: "user", content: text }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: modelId ?? undefined,
          attemptId,
          messages: history,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.message || `Gagal menghubungi AI (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE: tiap event dipisah baris kosong; data: {...}
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              setMessages((prev) => {
                const next = [...prev];
                const last = next[next.length - 1];
                if (last && last.role === "assistant") {
                  next[next.length - 1] = {
                    ...last,
                    content: last.content + delta,
                  };
                }
                return next;
              });
            }
          } catch {
            // abaikan chunk non-JSON (keep-alive, komentar, dll)
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Terjadi kesalahan.");
      setMessages((prev) => prev.filter((m) => m.content !== ""));
    } finally {
      setSending(false);
    }
  }, [attemptId, input, messages, modelId, sending]);

  if (models.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-[#12181c]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-white">
          💬 Tanya AI Tutor
          <span className="rounded-full bg-sky-400/15 px-2 py-0.5 text-[10px] font-medium text-sky-300">
            {models.length} model tersedia
          </span>
        </span>
        <span className="text-slate-500">{open ? "▲" : "▼"}</span>
      </button>

      {open ? (
        <div className="border-t border-white/[0.07] p-6 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">
              AI tutor tahu konteks quiz kamu (nilai & soal yang salah) dan
              bisa bantu menjelaskan materinya.
            </p>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              Model:
              <select
                value={modelId ?? ""}
                onChange={(e) => setModelId(Number(e.target.value))}
                className="rounded-lg border border-white/[0.12] bg-[#0e1316] px-2.5 py-1.5 text-xs text-white focus:border-sky-400 focus:outline-none"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.is_default === 1 ? " (default)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex max-h-[420px] min-h-[160px] flex-col gap-3 overflow-y-auto rounded-lg border border-white/[0.06] bg-black/20 p-4">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-500">
                Belum ada percakapan. Coba tanya misalnya:{" "}
                <em>&quot;Jelaskan kenapa jawaban soal nomor 2 salah?&quot;</em>
              </p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[85%] whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-sm leading-6 ${
                    m.role === "user"
                      ? "self-end bg-sky-500/15 text-sky-100"
                      : "self-start bg-white/[0.06] text-slate-200"
                  }`}
                >
                  {m.content || (m.role === "assistant" && sending ? "…" : "")}
                </div>
              ))
            )}
            <div ref={bottomRef} />
          </div>

          {error ? (
            <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
              {error}
            </p>
          ) : null}

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Tanyakan soal atau materi yang belum kamu pahami..."
              className="flex-1 rounded-lg border border-white/[0.12] bg-[#0e1316] px-3.5 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !input.trim()}
              className="rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-40"
            >
              {sending ? "..." : "Kirim"}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
