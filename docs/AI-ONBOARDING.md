# AI Onboarding — Konteks untuk AI Agent

> Catatan: file ini dimaksudkan sebagai `AGENTS.md`, tetapi penulisan file instruksi agent dilindungi sistem. AI agent: **baca file ini pertama kali** sebelum mengubah apa pun di repo ini.

## 1. Apa project ini

**Quiz-Algo** — platform quiz pre-test/post-test **per lesson** untuk siswa kursus Algonova (Python & Visual Programming). Live di `https://quiz-algo.erladitia.me`.

- Repo: `C:\Users\erlan\quiz-algo` — GitHub `erladitia14/quiz-algo`
- Owner: Aer (Erlangga Aditia). Bahasa UI & komunikasi: **Indonesia**.
- Ini project **terpisah** dari `ops-edu` (C:\Users\erlan\Documents\SaaS). Jangan mengubah codebase lain dari repo ini.

## 2. Aturan keras (constraints)

1. **Jangan pernah commit secret.** `DATABASE_URL`, API key AI, dsb. hanya hidup di `.env.local` (ter-gitignore) dan Vercel env (sensitive). Di dokumen, pakai placeholder.
2. **Grading harus tetap server-side.** `correct_index` dan `explanation` tidak boleh bocor ke client saat quiz berlangsung (endpoint `/api/quiz/start` tidak mengirimnya). Jangan "memperbaiki" ini demi kenyamanan.
3. **API key model AI tidak boleh dikirim ke client.** `/api/ai/models` hanya mengirim `id, name, description, is_default`. Chat di-proxy server-side.
4. **Quiz = per lesson.** Semua alur quiz memakai `lesson_id`. Jangan mengembalikan logika acak per course (keputusan 2026-08-11, lihat `DECISIONS.md`).
5. **Skema DB snake_case, flag 0/1 sebagai INTEGER** (bukan boolean), `options` sebagai JSON string, timestamp sebagai TEXT format `YYYY-MM-DD HH24:MI:SS` UTC. Pertahankan konvensi ini — data lama bergantung padanya.
6. **Halaman server component yang baca DB harus `export const dynamic = "force-dynamic"`** — data berubah terus; tidak boleh ter-cache statis.
7. Selesaikan dengan `npm run build` (harus hijau) + `npm run typecheck` sebelum commit. Push ke `main` langsung trigger deploy Vercel.

## 3. Stack & struktur cepat

Next.js 16 (App Router, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL (Neon) via `pg` Pool · AI via endpoint kompatibel OpenAI.

```
app/
  page.tsx                    # landing + statistik
  courses/page.tsx            # daftar course
  courses/[slug]/page.tsx     # silabus + tombol pre/post per lesson
  quiz/[lessonId]/page.tsx    # client component: intro → quiz → hasil
  hasil/[attemptId]/page.tsx  # pembahasan + widget AI tutor
  riwayat/page.tsx            # tabel semua attempt
  admin/                      # dashboard, soal, pengaturan, models (TANPA auth saat ini!)
  api/                        # lihat API.md
lib/
  db.ts                       # satu-satunya akses DB (async pg, semua fungsi di sini)
  ai.ts                       # router model AI (OpenAI-compatible, streaming SSE)
components/
  ai-tutor.tsx                # widget chat AI di halaman hasil
scripts/                      # migrasi, seed, audit (node .mjs)
data/
  question-bank/*.json        # 128 soal asli (versioned)
  material-texts/ -digest/ -tech/  # hasil ekstraksi PDF materi
  quiz.db                     # ARSIP SQLite lama — jangan dipakai lagi
docs/                         # dokumentasi lengkap
```

## 4. Lingkungan & rahasia

| Variabel | Wajib | Isi |
|---|---|---|
| `DATABASE_URL` | ✅ | Connection string Neon **pooler** (`.env.local` + Vercel env sensitive) |
| `AI_BASE_URL` | ❌ | Fallback base URL provider AI (kalau model tidak mengisi sendiri) |
| `AI_API_KEY` | ❌ | Fallback API key AI |

- DB Neon: project `sweet-water-25348071`, db `neondb`, role `neondb_owner`, region Singapore (`aws-ap-southeast-1`), endpoint pooler `ep-spring-river-az1ggcfz-pooler`. Kredensial ada di Vercel env — jangan ditulis di repo.
- Koneksi lokal: `new Pool({ connectionString, ssl: { rejectUnauthorized: false } })` (pola sudah ada di `lib/db.ts` dan semua script; deteksi localhost otomatis tanpa SSL).

## 5. Resep tugas umum

### Menambah soal untuk satu lesson
- Via UI: `/admin/soal` (pilih course → lesson → isi soal).
- Via script: insert langsung dengan `lesson_id` + `lesson_ref` + `module_ref` terisi, `options` = JSON string array, `difficulty` ∈ {easy, medium, hard}, `active = 1`. Target: **5–15 soal per lesson**.

### Menambah kolom/tabel DB
1. Tambahkan di `scripts/init-db.mjs` (untuk instalasi baru) **dan** buat script migrasi idempotent baru `scripts/migrate-*.mjs` (untuk DB yang sudah ada — pakai `IF NOT EXISTS`/`ADD COLUMN IF NOT EXISTS`).
2. Jalankan migrasinya terhadap Neon.
3. Update fungsi di `lib/db.ts` — semua akses DB hanya lewat file ini.

### Menambah API route
- Taruh di `app/api/...`, `export const dynamic = "force-dynamic"` untuk GET yang baca DB.
- Response konsisten: `{ ok: boolean, ...data }` atau `{ ok: false, message }` dengan status HTTP yang sesuai.
- Validasi input di server; jangan percaya body client (lihat pola grading di `app/api/quiz/submit/route.ts`).

### Menambah model AI
Tanpa kode: `/admin/models` → tambah model (nama, Model ID, Base URL, API key opsional, aktif, default) → tombol **Test**. Provider harus kompatibel OpenAI Chat Completions. Jika `base_url`/`api_key` kosong, fallback ke env `AI_BASE_URL`/`AI_API_KEY`.

## 6. Jebakan yang sudah pernah terjadi

- **pg ESM**: gunakan `import { Pool } from "pg"` + `import type { PoolClient }` (type-only import; error ESM jika salah).
- **Next 16 params async**: `params` di server component/route adalah `Promise` — harus `await params`.
- **`ROUND(float, int)` tidak ada di Postgres** — cast ke `numeric` dulu.
- Script `.mjs` di `scripts/` kadang dijalankan dengan cwd `scripts/` — path `.env.local` harus di-resolve relatif ke root (`path.resolve(__dirname, "..")`), bukan `process.cwd()`.
- Build pertama setelah refactor besar sering gagal karena import putus — jalankan `npm run build` lebih awal, bukan di akhir.
- Deployment Vercel sempat terkunci Deployment Protection — sekarang sudah OFF; jangan dinyalakan lagi tanpa alasan.
- `data/quiz.db` (SQLite) hanya arsip lokal. Jangan baca/tulis ke sana; semua data hidup di Neon.

## 7. Verifikasi perubahan

1. `npm run typecheck` → bersih
2. `npm run build` → hijau
3. Test lokal: `npm run dev` lalu coba alur: buka course → klik Pre-Test sebuah lesson → jawab → submit → halaman hasil muncul.
4. Setelah push, cek production `https://quiz-algo.erladitia.me` (HTTP 200, title "Quiz-Algo — Interactive Learning Platform").

## 8. Bacaan lanjutan

- Arsitektur & alur data → `ARCHITECTURE.md`
- Skema DB → `DATABASE.md`
- Semua API → `API.md`
- Deployment & env → `DEPLOYMENT.md`
- Riwayat keputusan → `DECISIONS.md`
