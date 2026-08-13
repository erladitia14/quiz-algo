# Quiz-Algo — Interactive Learning Platform

Platform quiz **pre-test & post-test per lesson** untuk course **Python** dan **Visual Programming** Algonova. Soal dibuat berdasarkan materi resmi (136 lesson dari 4 course). Dilengkapi **AI tutor** yang membahas hasil quiz peserta secara personal.

🌐 Live: **https://quiz-algo.erladitia.me** (Vercel + Neon PostgreSQL)

> **Untuk AI agent yang mempelajari project ini:** baca [`docs/AI-ONBOARDING.md`](./docs/AI-ONBOARDING.md) dulu, lalu folder [`docs/`](./docs/).

## Stack

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + React 19 + TypeScript |
| Styling | Tailwind CSS 4 (dark theme, tanpa design tokens terpusat) |
| Database | PostgreSQL di **Neon** (serverless, region Singapore) via `pg` pool |
| AI | Provider apa pun yang kompatibel OpenAI Chat Completions (streaming SSE) |
| Hosting | Vercel (git-push auto-deploy dari `main`) |

Keamanan inti: **grading dilakukan 100% di server** — `correct_index` dan `explanation` tidak pernah dikirim ke client saat quiz berlangsung; API key model AI tidak pernah keluar dari server.

## Menjalankan

```bash
npm install
npm run dev          # http://localhost:3001
npm run build        # production build (harus hijau sebelum push)
npm run typecheck    # tsc --noEmit
```

Wajib punya `.env.local` berisi `DATABASE_URL` (connection string Neon, pakai pooler). Detail di [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md).

## Fitur

| Fitur | Lokasi |
|---|---|
| Landing + statistik global | `/` |
| Daftar course | `/courses` |
| Detail course + silabus + tombol quiz per lesson | `/courses/[slug]` |
| Quiz per lesson — pre-test (tanpa timer) | `/quiz/[lessonId]?type=pre` |
| Quiz per lesson — post-test (timer + auto-submit) | `/quiz/[lessonId]?type=post` |
| Hasil + pembahasan + **AI tutor** | `/hasil/[attemptId]` |
| Riwayat semua percobaan (kolom lesson) | `/riwayat` |
| Admin: dashboard & statistik | `/admin` |
| Admin: CRUD soal (wajib pilih lesson tujuan) | `/admin/soal` |
| Admin: pengaturan (batas lulus, timer) | `/admin/pengaturan` |
| Admin: kelola model AI (CRUD + test koneksi) | `/admin/models` |

## Bank soal (per Agustus 2026)

- **702 soal aktif** tersebar di **136 lesson** (semua lesson ≥ 5 soal)
- Distribusi difficulty: ~50% easy, ~50% medium, sedikit hard
- 4 course: Python Start 1st Year, Python Start 2nd Year, Python Pro 2nd Year, Visual Programming
- Soal asli (128) tersimpan di `data/question-bank/*.json`; soal hasil generate ada langsung di database (via `scripts/generate-all-questions.mjs`)

## Aturan quiz (default, bisa diubah di `/admin/pengaturan`)

- **Quiz berjalan per lesson** — semua soal aktif lesson itu tampil (urutan diacak), bukan acak per course
- Batas kelulusan 70%
- Pre-test: tanpa timer, bebas diulang
- Post-test: timer 20 menit (default), auto-submit saat habis

## Dokumentasi lengkap

| File | Isi |
|---|---|
| [docs/AI-ONBOARDING.md](./docs/AI-ONBOARDING.md) | Konteks utama untuk AI agent: aturan, konvensi, resep tugas |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Arsitektur sistem, alur data, peta file |
| [docs/DATABASE.md](./docs/DATABASE.md) | Skema lengkap semua tabel + relasi |
| [docs/API.md](./docs/API.md) | Referensi semua API route (request/response) |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Setup Vercel + Neon, env vars, urutan script |
| [docs/DECISIONS.md](./docs/DECISIONS.md) | Riwayat project & keputusan desain (ADR) |

## Alur pipeline soal

```
materials/*.pdf (LMS Algonova, via ops-edu)
  → scripts/extract-materials.py        (data/material-texts)
  → scripts/make-digest.py / make-tech-digest.py  (data/material-digest, material-tech)
  → penulisan soal berbasis materi       (data/question-bank/*.json — 128 soal asli)
  → scripts/seed-questions.mjs          (DB: questions)
  → scripts/generate-all-questions.mjs  (menambah soal hingga tiap lesson ≥ 5)
  → quiz flow: start → jawab → submit (grading server-side) → hasil + pembahasan + AI tutor
```
