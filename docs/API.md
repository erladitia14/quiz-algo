# Referensi API Quiz-Algo

Semua route di `app/api/`. Konvensi response: `{ ok: true, ...data }` atau `{ ok: false, message: string }`.

## Quiz (publik)

### POST `/api/quiz/start`
Memulai quiz untuk satu lesson.
```json
// request
{ "lessonId": 123, "type": "pre" | "post" }
// response 200
{
  "ok": true,
  "course": { "slug": "python-start-1st-year" },
  "lesson": { "id": 123, "lesson_number": 4, "title": "...", "module_label": "Modul 1", "module_name": "..." },
  "type": "pre",
  "passThreshold": 70,
  "timerMinutes": 0,
  "questions": [{ "id": 1, "question": "...", "options": ["...", "..."] }]
}
```
- Semua soal aktif lesson dikembalikan, urutan `RANDOM()`.
- **`correct_index` dan `explanation` tidak ikut** (keamanan).
- Error: 400 lessonId invalid / bank soal kosong, 404 lesson tidak ditemukan.

### POST `/api/quiz/submit`
Grading server-side + simpan attempt.
```json
// request
{
  "lessonId": 123,
  "quizType": "pre" | "post",
  "studentName": "Nama Peserta",
  "startedAt": "ISO timestamp",
  "answers": [{ "questionId": 1, "selectedIndex": 2 }]
}
// response 200
{ "ok": true, "attemptId": 42, "score": 80, "correctCount": 4, "totalQuestions": 5 }
```
- Tiap `questionId` divalidasi milik `lessonId` tersebut (anti-cheat).
- Attempt + jawaban disimpan dalam satu transaksi; siswa dibuat otomatis bila baru.
- Error: 400 (nama kosong, jawaban kosong, soal tidak valid), 404 lesson tidak ada.

### GET `/api/courses?includeLessons=1`
Daftar course. Dengan `includeLessons=1` ikut mengembalikan lesson yang punya soal + `question_count`-nya (dipakai dropdown admin soal).

### GET `/api/attempts?course=<slug>&lesson=<id>`
Daftar attempt (maks 200, terbaru dulu). Filter opsional per course atau per lesson.

## AI (publik)

### GET `/api/ai/models`
Model AI **aktif** untuk dropdown user. **`api_key` tidak pernah dikirim.**
```json
{ "ok": true, "models": [{ "id": 1, "name": "...", "description": "...", "is_default": 1 }] }
```

### POST `/api/ai/chat`
Chat streaming dengan konteks attempt.
```json
// request
{ "modelId": 1, "attemptId": 42, "messages": [{ "role": "user", "content": "Jelaskan soal no 3" }] }
```
- Response: **stream SSE** dari provider (diteruskan apa adanya).
- Batas: maks 40 pesan, 8000 karakter/pesan. `maxDuration = 60` detik.
- Jika `attemptId` disertakan, server menyisipkan konteks (lesson, nilai, soal yang salah) sebagai system message.
- Model di-resolve: `modelId` → model enabled; tanpa modelId → model default enabled.
- Error 4xx bila pesan kosong / tidak ada model aktif.

## Admin (tanpa autentikasi saat ini ⚠️)

### `/api/admin/questions`
- `GET ?course=<slug>` — daftar soal (semua atau per course).
- `POST` — tambah soal. **Wajib `lesson_id`**; divalidasi lesson milik course tsb. `lesson_ref`/`module_ref` default diisi dari data lesson.
  ```json
  { "course_slug": "...", "lesson_id": 123, "question": "...", "options": ["..."], "correct_index": 0, "explanation": "...", "difficulty": "easy" }
  ```

### `/api/admin/questions/[id]`
- `PUT` — update parsial (COALESCE; field yang tidak dikirim tidak berubah). Mendukung `active` untuk enable/disable.
- `DELETE` — hapus permanen.

### `/api/admin/settings`
- `GET` — semua settings.
- `POST` — set `quiz_question_count`, `quiz_pass_threshold`, `quiz_timer_minutes` (harus angka).

### `/api/admin/models`
- `GET` — semua model AI (termasuk nonaktif; admin only).
- `POST` — tambah model: `{ name, model_id, base_url?, api_key?, description?, enabled?, is_default? }`. `is_default=1` men-reset default lain (transaksi).

### `/api/admin/models/[id]`
- `PATCH` — update model (semantik COALESCE; `is_default=1` men-reset default lain).
- `POST` — **test koneksi**: chat non-streaming pendek ke provider; response `{ ok, reply? }`.
- `DELETE` — hapus model.
