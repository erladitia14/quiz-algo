# Ops Edu Quiz Platform

Platform quiz **pre-test & post-test** untuk course **Python** dan **Visual Programming** Algonova. Soal dibuat **berdasarkan materi resmi** (136 PDF lesson dari 4 course) yang sudah didownload dari LMS Algonova.

> Project terpisah dari `ops-edu` (C:\Users\erlan\Documents\SaaS) agar siap di-hosting sendiri.

## Stack

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4**
- **SQLite** (better-sqlite3) — file `data/quiz.db`
- Soal di-grading di server; kunci jawaban tidak pernah dikirim ke client

## Menjalankan

```bash
npm install
npm run dev        # http://localhost:3001
```

Port 3001 supaya bisa jalan bareng ops-edu (port 3000).

### Setup database (dari nol)

```bash
node scripts/init-db.mjs          # buat tabel
node scripts/sync-from-ops-edu.mjs # sync course+lesson dari ops-edu DB
node scripts/seed-questions.mjs   # seed 128 soal dari question-bank
```

Path DB ops-edu bisa di-override: `OPS_EDU_DB_PATH=... node scripts/sync-from-ops-edu.mjs`

## Fitur

| Fitur | Lokasi |
|---|---|
| Landing + statistik | `/` |
| Daftar course | `/courses` |
| Detail course + silabus | `/courses/[slug]` |
| Quiz pre-test (tanpa timer) | `/quiz/[slug]?type=pre` |
| Quiz post-test (timer 20 menit, auto-submit) | `/quiz/[slug]?type=post` |
| Hasil + pembahasan per soal | `/hasil/[attemptId]` |
| Riwayat semua percobaan | `/riwayat` |
| Admin: dashboard & statistik | `/admin` |
| Admin: CRUD soal (tambah/aktif-nonaktif/hapus) | `/admin/soal` |
| Admin: pengaturan (jumlah soal, batas lulus, timer) | `/admin/pengaturan` |
| Admin: kelola model AI (tambah/edit/test/aktif/default/hapus) | `/admin/models` |
| AI tutor di halaman hasil quiz (model dipilih user dari yang diaktifkan admin) | `/hasil/[attemptId]` |

## Model AI (AI tutor)

Model AI dikelola admin lewat `/admin/models` — tanpa perlu ubah kode:

- Setiap model = nama tampilan + **Model ID** + Base URL + API key (opsional) + status aktif/default.
- Endpoint harus **kompatibel OpenAI Chat Completions**: OpenAI, 9Router, Groq, OpenRouter, DeepSeek, dll.
- Base URL / API key kosong → fallback env global `AI_BASE_URL` / `AI_API_KEY` (set di Vercel env / `.env.local`).
- Tombol **Test** di tabel memverifikasi koneksi ke provider.
- User melihat dropdown model di halaman hasil quiz (`/hasil/[attemptId]`) — isinya **otomatis mengikuti** model yang admin aktifkan. Jika belum ada model aktif, widget AI tutor disembunyikan.
- API key tidak pernah dikirim ke client; chat di-proxy server-side (`POST /api/ai/chat`, streaming SSE) dan diberi konteks nilai + soal yang salah dari attempt peserta.

## Bank soal

| Course | Soal | Sumber materi |
|---|---|---|
| Python Start 1st Year | 30 | modul 1-7 (basics s/d Pygame & hackathon) |
| Python Start 2nd Year | 37 | modul 1-7 (PyQt, file, PIL, Pygame, Git) |
| Python Pro 2nd Year | 26 | modul 1-7 (Kivy, Pandas, ML, Panda3D, Flask) |
| Visual Programming | 35 | modul 1-7 (Scratch: koordinat s/d clone) |

Soal disimpan di `data/question-bank/*.json` (versioned, bisa di-review) lalu di-seed ke DB.

## Aturan quiz (default, bisa diubah di /admin/pengaturan)

- 10 soal acak per percobaan
- Batas kelulusan 70%
- Pre-test: tanpa timer, bebas diulang
- Post-test: timer 20 menit, auto-submit saat habis

## Alur data

```
materials/*.pdf (ops-edu) 
  → scripts/extract-materials.py  (data/material-texts)
  → penulisan soal berbasis materi  (data/question-bank)
  → scripts/seed-questions.mjs    (data/quiz.db: questions)
  → quiz flow: start → jawab → submit (grading server-side) → hasil + pembahasan
```

## Deployment

1. Upload project ke hosting (Vercel tidak cocok untuk SQLite file-based; pilihan: VPS + `npm run build && npm start`, atau Railway/Render dengan volume untuk `data/`).
2. Jalankan `init-db` + `sync-from-ops-edu` + `seed-questions` sekali di server.
3. Set port: `next start -p <port>` (script `start` sudah pakai 3001).

## Black-box testing (2026-08-07) — semua lulus

- 13 halaman: 200 semua; course tidak ada → 404; hasil tidak ada → 404
- Quiz start pre/post: 10 soal acak, threshold 70, timer post 20 menit
- Quiz start course palsu → ditolak
- Submit: grading benar (7/10 → 70%), divalidasi server-side
- Submit tanpa nama / soal palsu → ditolak
- CRUD soal admin: tambah → update → hapus → hapus lagi (404)
- Settings: ubah threshold → restore → nilai non-angka ditolak
- Security: correct_index/explanation TIDAK bocor ke client
- Randomisasi: set soal berbeda tiap percobaan
- Production build: sukses
