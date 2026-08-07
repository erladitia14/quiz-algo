"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/settings");
      const payload = await response.json();
      if (payload.ok) setSettings(payload.settings || {});
    } catch {
      setError("Gagal memuat pengaturan.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setError("");
    setNotice("");
    setSaving(true);
    try {
      const response = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quiz_question_count: settings.quiz_question_count,
          quiz_pass_threshold: settings.quiz_pass_threshold,
          quiz_timer_minutes: settings.quiz_timer_minutes,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) {
        throw new Error(payload.message || "Gagal menyimpan.");
      }
      setSettings(payload.settings);
      setNotice("Pengaturan tersimpan.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  const fields: Array<{ key: string; label: string; help: string }> = [
    {
      key: "quiz_question_count",
      label: "Jumlah soal per quiz",
      help: "Berapa soal acak yang tampil di setiap pre-test/post-test.",
    },
    {
      key: "quiz_pass_threshold",
      label: "Batas kelulusan (%)",
      help: "Nilai minimal agar peserta dinyatakan lulus.",
    },
    {
      key: "quiz_timer_minutes",
      label: "Durasi timer post-test (menit)",
      help: "Batas waktu post-test; pre-test tanpa batas waktu.",
    },
  ];

  return (
    <div className="mx-auto max-w-xl">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber-400">
        Admin · Pengaturan
      </p>
      <h1 className="mt-2 text-2xl font-semibold text-white">
        Pengaturan quiz
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        <Link href="/admin" className="text-sky-400 underline">
          ← Kembali ke dashboard
        </Link>
      </p>

      {error ? (
        <p className="mt-4 rounded-lg border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="mt-4 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {notice}
        </p>
      ) : null}

      <div className="mt-6 flex flex-col gap-5 rounded-xl border border-white/[0.08] bg-[#12181c] p-6">
        {fields.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1.5 block text-sm font-medium text-white">
              {field.label}
            </span>
            <input
              type="number"
              min={1}
              value={settings[field.key] ?? ""}
              onChange={(e) =>
                setSettings((s) => ({ ...s, [field.key]: e.target.value }))
              }
              className="w-full rounded-lg border border-white/[0.12] bg-[#0e1316] px-3 py-2.5 text-sm text-white"
            />
            <span className="mt-1 block text-xs text-slate-500">
              {field.help}
            </span>
          </label>
        ))}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {saving ? "Menyimpan..." : "Simpan pengaturan"}
        </button>
      </div>
    </div>
  );
}
