"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

type AiModelRow = {
  id: number;
  name: string;
  model_id: string;
  base_url: string;
  api_key: string;
  description: string;
  enabled: number;
  is_default: number;
  created_at: string;
};

type FormState = {
  name: string;
  model_id: string;
  base_url: string;
  api_key: string;
  description: string;
  enabled: boolean;
  is_default: boolean;
};

const emptyForm: FormState = {
  name: "",
  model_id: "",
  base_url: "",
  api_key: "",
  description: "",
  enabled: true,
  is_default: false,
};

function maskKey(key: string): string {
  if (!key) return "(pakai AI_API_KEY global)";
  if (key.length <= 10) return "••••••••";
  return `${key.slice(0, 6)}•••${key.slice(-4)}`;
}

export default function AdminModelsPage() {
  const [models, setModels] = useState<AiModelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/models");
      const payload = await response.json();
      if (payload.ok) setModels(payload.models || []);
    } catch {
      setError("Gagal memuat daftar model.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const applyModels = (payload: { ok?: boolean; models?: AiModelRow[]; message?: string }) => {
    if (payload.ok && payload.models) {
      setModels(payload.models);
    } else {
      throw new Error(payload.message || "Operasi gagal.");
    }
  };

  const submitForm = async () => {
    setError("");
    setNotice("");
    if (!form.name.trim() || !form.model_id.trim()) {
      setError("Nama tampilan dan Model ID wajib diisi.");
      return;
    }
    setSaving(true);
    try {
      const isEdit = editingId !== null;
      const response = await fetch(
        isEdit ? `/api/admin/models/${editingId}` : "/api/admin/models",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name,
            model_id: form.model_id,
            base_url: form.base_url,
            api_key: form.api_key,
            description: form.description,
            enabled: form.enabled,
            is_default: form.is_default,
          }),
        },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "Gagal menyimpan.");
      applyModels(payload);
      setNotice(isEdit ? "Model diperbarui." : "Model ditambahkan.");
      setForm(emptyForm);
      setEditingId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (row: AiModelRow) => {
    setEditingId(row.id);
    setForm({
      name: row.name,
      model_id: row.model_id,
      base_url: row.base_url,
      api_key: "", // jangan pernah prefill key; kosong = tidak diubah
      description: row.description,
      enabled: row.enabled === 1,
      is_default: row.is_default === 1,
    });
    setError("");
    setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const toggleEnabled = async (row: AiModelRow) => {
    try {
      const response = await fetch(`/api/admin/models/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: row.enabled === 1 ? 0 : 1 }),
      });
      const payload = await response.json();
      applyModels(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah status.");
    }
  };

  const setDefault = async (row: AiModelRow) => {
    try {
      const response = await fetch(`/api/admin/models/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_default: true }),
      });
      const payload = await response.json();
      applyModels(payload);
      setNotice(`"${row.name}" dijadikan model default.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mengubah default.");
    }
  };

  const remove = async (row: AiModelRow) => {
    if (!confirm(`Hapus model "${row.name}"?`)) return;
    try {
      const response = await fetch(`/api/admin/models/${row.id}`, {
        method: "DELETE",
      });
      const payload = await response.json();
      applyModels(payload);
      setNotice("Model dihapus.");
      if (editingId === row.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menghapus.");
    }
  };

  const test = async (row: AiModelRow) => {
    setTestingId(row.id);
    setTestResult((t) => ({ ...t, [row.id]: "" }));
    try {
      const response = await fetch(`/api/admin/models/${row.id}`, {
        method: "POST",
      });
      const payload = await response.json();
      setTestResult((t) => ({
        ...t,
        [row.id]: payload.ok
          ? `✓ Terhubung. Balasan: "${(payload.reply || "").slice(0, 60)}"`
          : `✗ ${payload.error || payload.message || "Gagal"}`,
      }));
    } catch {
      setTestResult((t) => ({ ...t, [row.id]: "✗ Gagal menghubungi server." }));
    } finally {
      setTestingId(null);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-white/[0.12] bg-[#0e1316] px-3 py-2.5 text-sm text-white placeholder:text-slate-600 focus:border-sky-400 focus:outline-none";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
          Admin · Model AI
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">
          Kelola model AI
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Tambah model yang bisa dipakai peserta lewat AI tutor di halaman
          hasil quiz. Endpoint harus kompatibel OpenAI Chat Completions
          (OpenAI, 9Router, Groq, OpenRouter, dll).{" "}
          <Link href="/admin" className="text-sky-400 underline">
            ← Kembali ke dashboard
          </Link>
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </p>
      ) : null}

      {/* Form tambah / edit */}
      <section className="rounded-xl border border-white/[0.08] bg-[#12181c] p-6">
        <h2 className="text-lg font-semibold text-white">
          {editingId ? `Edit model #${editingId}` : "Tambah model baru"}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white">
              Nama tampilan *
            </span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contoh: Claude Haiku (9Router)"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white">
              Model ID *
            </span>
            <input
              type="text"
              value={form.model_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, model_id: e.target.value }))
              }
              placeholder="Contoh: kr/claude-haiku-4.5"
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white">
              Base URL
            </span>
            <input
              type="text"
              value={form.base_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, base_url: e.target.value }))
              }
              placeholder="Kosongkan untuk default env (AI_BASE_URL)"
              className={inputClass}
            />
            <span className="mt-1 block text-xs text-slate-500">
              Contoh: https://api.openai.com/v1 — tanpa /chat/completions di
              akhir.
            </span>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-white">
              API key {editingId ? "(kosongkan = tidak diubah)" : ""}
            </span>
            <input
              type="password"
              value={form.api_key}
              onChange={(e) =>
                setForm((f) => ({ ...f, api_key: e.target.value }))
              }
              placeholder="Kosongkan untuk pakai env AI_API_KEY"
              className={inputClass}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-medium text-white">
              Deskripsi (opsional)
            </span>
            <input
              type="text"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Contoh: Cepat dan murah untuk tanya jawab"
              className={inputClass}
            />
          </label>
          <div className="flex items-center gap-6 sm:col-span-2">
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) =>
                  setForm((f) => ({ ...f, enabled: e.target.checked }))
                }
                className="h-4 w-4 accent-sky-500"
              />
              Aktif (bisa dipakai user)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={form.is_default}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_default: e.target.checked }))
                }
                className="h-4 w-4 accent-amber-500"
              />
              Jadikan model default
            </label>
          </div>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={() => void submitForm()}
            disabled={saving}
            className="rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
          >
            {saving
              ? "Menyimpan..."
              : editingId
                ? "Simpan perubahan"
                : "Tambah model"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
              className="rounded-lg border border-white/[0.12] px-5 py-3 text-sm text-slate-300 hover:bg-white/[0.06]"
            >
              Batal
            </button>
          ) : null}
        </div>
      </section>

      {/* Daftar model */}
      <section>
        <h2 className="text-lg font-semibold text-white">
          Daftar model ({models.length})
        </h2>
        {loading ? (
          <p className="mt-3 text-sm text-slate-500">Memuat...</p>
        ) : models.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            Belum ada model. Tambahkan model pertama di form di atas — selama
            belum ada model aktif, tombol AI tutor disembunyikan dari user.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#12181c]">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3 font-medium">Nama</th>
                  <th className="px-4 py-3 font-medium">Model ID</th>
                  <th className="px-4 py-3 font-medium">Base URL</th>
                  <th className="px-4 py-3 font-medium">API key</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {models.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-white/[0.05] last:border-0"
                  >
                    <td className="px-4 py-3 text-white">
                      <span className="font-medium">{row.name}</span>
                      {row.is_default === 1 ? (
                        <span className="ml-2 rounded-full bg-amber-400/15 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                          DEFAULT
                        </span>
                      ) : null}
                      {row.description ? (
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {row.description}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">
                      {row.model_id}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3 font-mono text-xs text-slate-400">
                      {row.base_url || "(env default)"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">
                      {maskKey(row.api_key)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          row.enabled === 1
                            ? "bg-emerald-400/15 text-emerald-300"
                            : "bg-slate-500/15 text-slate-400"
                        }`}
                      >
                        {row.enabled === 1 ? "AKTIF" : "NONAKTIF"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <button
                          type="button"
                          onClick={() => test(row)}
                          disabled={testingId === row.id}
                          className="rounded-md border border-white/[0.12] px-2.5 py-1.5 text-slate-300 hover:bg-white/[0.06] disabled:opacity-40"
                        >
                          {testingId === row.id ? "Menguji..." : "Test"}
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(row)}
                          className="rounded-md border border-white/[0.12] px-2.5 py-1.5 text-slate-300 hover:bg-white/[0.06]"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleEnabled(row)}
                          className="rounded-md border border-white/[0.12] px-2.5 py-1.5 text-slate-300 hover:bg-white/[0.06]"
                        >
                          {row.enabled === 1 ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                        {row.is_default === 0 ? (
                          <button
                            type="button"
                            onClick={() => void setDefault(row)}
                            className="rounded-md border border-amber-400/30 px-2.5 py-1.5 text-amber-300 hover:bg-amber-400/10"
                          >
                            Jadikan default
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => void remove(row)}
                          className="rounded-md border border-rose-400/30 px-2.5 py-1.5 text-rose-300 hover:bg-rose-400/10"
                        >
                          Hapus
                        </button>
                      </div>
                      {testResult[row.id] ? (
                        <p
                          className={`mt-2 text-xs ${
                            testResult[row.id].startsWith("✓")
                              ? "text-emerald-300"
                              : "text-rose-300"
                          }`}
                        >
                          {testResult[row.id]}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
