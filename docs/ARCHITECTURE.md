# Arsitektur Quiz-Algo

## Gambaran umum

```
Browser (siswa/admin)
   │  HTTPS
   ▼
Vercel (Next.js 16, App Router, serverless)
   │  pg Pool (SSL)                │  HTTPS (OpenAI-compatible)
   ▼                               ▼
Neon PostgreSQL                Provider AI
(serverless, Singapore)        (OpenAI / 9Router / Groq / dll.)
```

- **Satu codebase Next.js** — server component render halaman + route handler `app/api/*` jadi backend.
- **Tidak ada backend terpisah, tidak ada ORM.** Semua query SQL ada di `lib/db.ts` (async `pg`).
- **State quiz ada di client, kebenaran ada di server.** Client hanya menerima pertanyaan + opsi; kunci jawaban & pembahasan baru muncul di halaman hasil setelah attempt tercatat.

## Alur data utama

### 1. Mengerjakan quiz (per lesson)

```
GET  /courses/[slug]            → daftar lesson + jumlah soal + statistik pre/post tiap lesson
POST /api/quiz/start            ← { lessonId, type: "pre"|"post" }
                                  → soal lesson itu (RANDOM order), TANPA correct_index/explanation
     (client: siswa mengisi jawaban, timer untuk post-test)
POST /api/quiz/submit           ← { lessonId, quizType, studentName, startedAt, answers[] }
     server grading: tiap questionId divalidasi milik lesson tsb (getQuestionForGrading)
     → INSERT quiz_attempts (lesson_id tercatat) + attempt_answers dalam satu transaksi
                                  → { attemptId, score, correctCount }
GET  /hasil/[attemptId]         → pembahasan lengkap + widget AI tutor
```

### 2. AI tutor (di halaman hasil)

```
GET  /api/ai/models             → hanya model enabled: {id, name, description, is_default} — TANPA api_key
POST /api/ai/chat               ← { modelId, messages[], attemptId? }
     server: resolveEnabledModel() → lib/ai.resolveProvider(model)
       base_url/api_key model → fallback env AI_BASE_URL/AI_API_KEY → default api.openai.com
     konteks attempt (lesson, nilai, daftar soal yang salah) disisipkan sebagai system message
     → fetch {base_url}/chat/completions (stream: true)
     → stream SSE provider diteruskan apa adanya ke client (ReadableStream)
```

### 3. Admin mengelola soal & model AI

```
/admin/soal     → POST /api/admin/questions        (wajib lesson_id; divalidasi milik course)
                → PUT/DELETE /api/admin/questions/[id]
/admin/models   → GET/POST /api/admin/models
                → PATCH /api/admin/models/[id]     (update; is_default=1 men-reset default lain)
                → POST /api/admin/models/[id]      (test koneksi — chat non-streaming pendek)
                → DELETE /api/admin/models/[id]
/admin/pengaturan → POST /api/admin/settings       (quiz_pass_threshold, quiz_timer_minutes, ...)
```

⚠️ **Admin saat ini tanpa autentikasi** — siapa pun yang tahu URL bisa mengelola. Ini keputusan sadar untuk tahap sekarang (user internal), tercatat di DECISIONS.md.

## Peta file penting

| File | Peran |
|---|---|
| `lib/db.ts` | **Satu-satunya** akses database. Semua fungsi query di sini (courses, lessons, questions, attempts, stats, settings, ai_models). |
| `lib/ai.ts` | Router provider AI: `resolveProvider`, `streamChat` (SSE), `testChat`. |
| `components/ai-tutor.tsx` | Widget chat di `/hasil/[attemptId]`. Dropdown model dinamis; tersembunyi jika belum ada model aktif. |
| `app/quiz/[lessonId]/page.tsx` | Client component inti quiz: intro (input nama) → quiz (satu soal per layar, timer) → hasil. |
| `app/api/quiz/start/route.ts` | Mulai quiz per lesson. |
| `app/api/quiz/submit/route.ts` | Grading server-side + simpan attempt. |
| `app/courses/[slug]/page.tsx` | Silabus + tombol Pre/Post per lesson + statistik per lesson. |
| `scripts/init-db.mjs` | Skema lengkap (idempotent) — sumber kebenaran struktur tabel. |
| `scripts/migrate-to-lesson-quiz.mjs` | Migrasi per-course → per-lesson (sudah dijalankan 2026-08-11). |
| `scripts/generate-all-questions.mjs` | Generator soal untuk memenuhi target ≥5 soal/lesson (sudah dijalankan). |

## Konvensi kode

- **Bahasa**: komentar, pesan error, dan UI dalam Bahasa Indonesia.
- **Response API**: `{ ok: true, ...data }` / `{ ok: false, message }`.
- **Server pages baca DB**: wajib `export const dynamic = "force-dynamic"`.
- **Flag boolean**: INTEGER 0/1 di DB (warisan skema SQLite).
- **Timestamp**: TEXT `YYYY-MM-DD HH24:MI:SS` UTC via `to_char(now() AT TIME ZONE 'UTC', ...)`.
- **Params Next 16**: selalu `await params` (berupa Promise).
