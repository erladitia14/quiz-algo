# Deployment & Lingkungan

## Topologi

```
GitHub erladitia14/quiz-algo (branch main)
   │  auto-deploy on push (Vercel Git integration)
   ▼
Vercel project: quiz-algo (prj_oyxgT0LcNWw1NxaYAtMd0Uk7EjAm)
   │  deployment protection: OFF (publik)
   ▼
Domain: quiz-algo.erladitia.me
   (CNAME Cloudflare → Vercel, record diurus Aer)
   ▼
Neon PostgreSQL (Singapore) — DATABASE_URL via pooler
```

## Environment variables

| Variabel | Vercel | `.env.local` | Keterangan |
|---|---|---|---|
| `DATABASE_URL` | ✅ sensitive | ✅ | Connection string Neon **pooler** (`ep-spring-river-az1ggcfz-pooler...`). Jangan pakai direct endpoint di serverless. |
| `AI_BASE_URL` | opsional | opsional | Fallback base URL provider AI (default `https://api.openai.com/v1`) |
| `AI_API_KEY` | opsional | opsional | Fallback API key AI. Model di `/admin/models` bisa mengisi sendiri per model. |

⚠️ Nilai asli kredensial **tidak ditulis di repo ini**. `DATABASE_URL` tersimpan sebagai sensitive env di Vercel project; lokal di `.env.local` (ter-gitignore).

## Detail infrastruktur

- **Neon**: project `sweet-water-25348071`, org `org-wild-dust-86209434`, region `aws-ap-southeast-1` (Singapore), db `neondb`, role `neondb_owner`. Free tier. Login Google (email owner).
- **Vercel**: framework Next.js, build `next build`, output default. Deployment Protection sudah dimatikan (sempat terkunci pada 2026-08-10, sudah diperbaiki).
- **DNS**: Cloudflare — CNAME `quiz-algo.erladitia.me`. Perubahan record dilakukan manual oleh Aer.
- **AI provider**: bebas apa pun yang kompatibel OpenAI Chat Completions (OpenAI, 9Router gateway, Groq, DeepSeek, OpenRouter, Ollama, dll.) — dikonfigurasi lewat `/admin/models` tanpa redeploy.

## Setup dari nol (recovery)

```bash
git clone https://github.com/erladitia14/quiz-algo.git
cd quiz-algo
npm install
echo "DATABASE_URL=postgresql://..." > .env.local   # dari Neon console (pakai pooler)

node scripts/init-db.mjs                 # buat semua tabel (idempotent)
node scripts/migrate-to-lesson-quiz.mjs  # pastikan kolom lesson_id ada (idempotent)
node scripts/seed-questions.mjs          # seed 128 soal asli dari data/question-bank
# (opsional) node scripts/generate-all-questions.mjs  # tambah soal hingga ≥5/lesson

npm run build && npm run start           # port 3001
```

Catatan: `seed-questions.mjs` dan `sync-from-ops-edu.mjs` berasumsi data awal; untuk DB yang sudah berisi 702 soal, **jangan** jalankan seed ulang tanpa cek duplikat.

## Cek kesehatan

```bash
curl -sI https://quiz-algo.erladitia.me/          # → HTTP 200
curl -s https://quiz-algo.erladitia.me/ | grep -o '<title>[^<]*'
# → Quiz-Algo — Interactive Learning Platform
```

## Catatan operasional

- Push ke `main` = langsung deploy. Pastikan `npm run build` hijau dulu.
- Setelah ubah env di Vercel, redeploy diperlukan (env tidak hot-reload).
- Neon free tier auto-suspend; request pertama setelah idle sedikit lambat (cold start pooler).
- Tidak ada cron/background job di project ini.
