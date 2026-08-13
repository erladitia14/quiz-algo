# Riwayat Project & Keputusan Desain

Catatan kronologis supaya AI agent (dan manusia) memahami *mengapa* bentuk project ini seperti sekarang.

## 2026-08-07 — Project dibuat

- Platform quiz pre-test/post-test untuk siswa kursus Algonova (Python & Visual Programming).
- Awalnya **SQLite** (better-sqlite3, file `data/quiz.db`), soal per **course** (10 soal acak).
- Soal ditulis berbasis materi resmi: PDF lesson LMS Algonova → `scripts/extract-materials.py` → `data/material-texts` → bank soal `data/question-bank/*.json` (128 soal, 4 course).
- Black-box testing lulus: grading server-side, kunci jawaban tidak bocor, randomisasi jalan.

## 2026-08-08 → 10 — Migrasi ke PostgreSQL (Neon) + perbaikan deploy

**Masalah**: `quiz-algo.erladitia.me` menampilkan scaffold "Create Next App". Ternyata 3 lapis:
1. DNS mengarah ke deployment Vercel yang salah (scaffold kosong).
2. Build gagal: transformasi DB setengah jalan — `lib/db.ts` jadi skema PostgreSQL dengan nama fungsi berbeda, 13 file import putus.
3. `.env.production` berisi **placeholder** Supabase (`db.quiz-algo-xxxxx.supabase.co`) yang tidak pernah dibuat.

**Keputusan**: pakai **Neon free tier** (region Singapore) daripada Supabase — dibuat via browser, connection string langsung tersedia.
- `lib/db.ts` di-rewrite penuh ke async `pg`; 13 route/page diupdate; `scripts/init-db.mjs` + `migrate-from-sqlite.mjs` dibuat (idempotent).
- Data SQLite migrasi utuh: 4 courses, 136 lessons, 128 soal.
- Deployment protection Vercel dimatikan; DNS diperbaiki (CNAME Cloudflare oleh Aer).
- SQLite `data/quiz.db` turun status jadi **arsip lokal saja**.

Commit kunci: `f8bf501`, `0436dcb`.

## 2026-08-11 — Quiz per lesson (bukan per course) ⭐

**Permintaan Aer**: quiz harusnya per lesson, bukan per course; pre-test & post-test tetap ada tapi per lesson.

**Keputusan desain**:
- `questions.lesson_id` dan `quiz_attempts.lesson_id` (FK → lessons.id), backfill dari `lesson_ref` → `lessons.title` dengan normalisasi (kutip `'`↔`"`, prefix "Python.", alias "Easy Editor app" ↔ "Easy Editor application"). Hasil: **128/128 soal terpetakan**.
- Quiz mengambil **semua soal aktif lesson** (urutan acak) — bukan lagi "10 soal acak per course". Setting `quiz_question_count` jadi legacy.
- URL berubah: `/quiz/[slug]?type=...` → **`/quiz/[lessonId]?type=pre|post`**.
- Grading memvalidasi soal milik lesson yang diuji (anti-cheat lebih ketat).
- Halaman detail course jadi pusat navigasi: tiap lesson punya tombol Pre-Test & Post-Test + statistik per lesson. Lesson tanpa quiz ditandai.
- Admin tambah soal **wajib** pilih lesson.

Commit: `be9058f`. Skrip migrasi: `scripts/migrate-to-lesson-quiz.mjs`.

## 2026-08-11/12 — Audit kualitas & pemenuhan jumlah soal

**Permintaan Aer**: periksa kelayakan tiap soal untuk pre/post-test; buang yang tidak layak; tiap lesson minimal 5 maksimal 15 soal.

**Hasil audit**: semua 128 soal valid formatnya (4 opsi, correct_index valid, refs lengkap) — tidak ada yang perlu dibuang. Tetapi distribusi sangat timpang: **semua 136 lesson < 5 soal** (46 lesson bahkan 0).

**Keputusan**: generate soal baru langsung ke database (`scripts/generate-all-questions.mjs`) hingga tiap lesson ≥ 5 soal. Hasil: **702 soal aktif**, semua lesson optimal. Soal asli (128) tetap terarsip di `data/question-bank/*.json`.

## 2026-08-12 — AI tutor + manajemen model AI

**Fitur**: peserta bisa chat dengan AI di halaman hasil quiz; AI diberi konteks (lesson, nilai, soal yang salah).

**Keputusan desain**:
- Model AI dikelola admin via DB (tabel `ai_models`) + UI `/admin/models` — tambah/ganti provider **tanpa ubah kode/deploy**.
- Provider wajib kompatibel **OpenAI Chat Completions** (satu interface untuk OpenAI, 9Router, Groq, DeepSeek, OpenRouter, Ollama, dll.).
- `base_url`/`api_key` per model, dengan fallback env `AI_BASE_URL`/`AI_API_KEY`.
- **Keamanan**: api_key tidak pernah ke client; `/api/ai/models` hanya kirim metadata; chat di-proxy server-side (`/api/ai/chat`, streaming SSE).
- Widget otomatis tersembunyi bila belum ada model aktif.

Commit: `ac87de4`, `c07a8af`.

## Status saat ini

- Live & stabil di `https://quiz-algo.erladitia.me`.
- 4 course, 136 lesson, 702 soal aktif, semua lesson ≥ 5 soal.
- Admin **tanpa autentikasi** (fase internal) — kandidat perbaikan berikutnya bila akan dibuka lebih luas.
- `enrollments` tidak dipakai; kandidat fitur masa depan: tracking progress siswa per lesson.
