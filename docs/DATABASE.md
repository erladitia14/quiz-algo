# Skema Database Quiz-Algo

Database: **PostgreSQL di Neon** — project `sweet-water-25348071`, db `neondb`, role `neondb_owner`, region `aws-ap-southeast-1` (Singapore). Sumber kebenaran skema: `scripts/init-db.mjs` (idempotent).

**Konvensi:**
- Flag boolean = `INTEGER` 0/1 (warisan skema SQLite lama)
- Timestamp = `TEXT` format `YYYY-MM-DD HH24:MI:SS` UTC
- Array (options soal) = JSON string di kolom `TEXT`
- Foreign key utama lewat `courses.slug` (bukan id) dan `lessons.id`

## Diagram relasi

```
courses (slug UNIQUE)
  │ 1:N
  ├── lessons ────────────────┐ 1:N
  │                            ├── questions (lesson_id FK → lessons.id)
  ├── questions (course_slug)  │
  │                            │
  ├── quiz_attempts (course_slug)
  │      └─ lesson_id FK → lessons.id
  │      └─ student_id FK → students.id
  │           └─ attempt_answers (attempt_id, question_id)
  └── enrollments (student_id, course_slug)

students
ai_models          (independen — untuk AI tutor)
settings           (key-value)
```

## Tabel

### courses
| Kolom | Tipe | Ket |
|---|---|---|
| id | SERIAL PK | |
| slug | TEXT UNIQUE NOT NULL | identifier utama (dipakai FK) |
| title, track | TEXT NOT NULL | judul & track ("Python"/"Visual Programming") |
| description | TEXT DEFAULT '' | |
| total_lessons | INTEGER DEFAULT 0 | denormalisasi jumlah lesson |
| active | INTEGER DEFAULT 1 | |
| created_at, updated_at | TEXT | UTC |

Data saat ini: 4 course — `python-start-1st-year`, `python-start-2nd-year`, `python-pro-2nd-year`, `visual-programming`.

### lessons
| Kolom | Tipe | Ket |
|---|---|---|
| id | SERIAL PK | |
| course_slug | TEXT FK → courses.slug ON DELETE CASCADE | |
| lesson_number | INTEGER NOT NULL | urutan dalam course |
| module_label | TEXT DEFAULT '' | mis. "Modul 1" |
| module_name | TEXT DEFAULT '' | nama modul |
| title | TEXT NOT NULL | judul lesson (bahasa Inggris, dari kurikulum) |
| pdf_path | TEXT DEFAULT '' | path materi PDF |
| active | INTEGER DEFAULT 1 | |

Index: `idx_lessons_course (course_slug)`. Data: 136 lesson aktif.

### questions
| Kolom | Tipe | Ket |
|---|---|---|
| id | SERIAL PK | |
| course_slug | TEXT FK → courses.slug ON DELETE CASCADE | |
| lesson_id | INTEGER FK → lessons.id (NULL-able) | **quiz berjalan per kolom ini** |
| lesson_ref | TEXT DEFAULT '' | judul lesson (teks, historis) |
| module_ref | TEXT DEFAULT '' | label modul (teks, historis) |
| question | TEXT NOT NULL | teks soal (Bahasa Indonesia) |
| options | TEXT NOT NULL | **JSON string** array pilihan jawaban |
| correct_index | INTEGER NOT NULL | indeks jawaban benar (0-based) — jangan pernah kirim ke client saat quiz |
| explanation | TEXT DEFAULT '' | pembahasan — hanya tampil di halaman hasil |
| difficulty | TEXT DEFAULT 'easy' | easy / medium / hard |
| active | INTEGER DEFAULT 1 | soft delete |

Index: `idx_questions_course`, `idx_questions_lesson`. Data: 702 soal aktif, semua lesson ≥ 5 soal.

### quiz_attempts
| Kolom | Tipe | Ket |
|---|---|---|
| id | SERIAL PK | |
| student_id | INTEGER FK → students.id ON DELETE SET NULL (NULL-able) | |
| student_name | TEXT NOT NULL | nama yang diinput peserta |
| course_slug | TEXT FK → courses.slug ON DELETE CASCADE | denormalisasi dari lesson |
| lesson_id | INTEGER FK → lessons.id (NULL-able) | **attempt per lesson** |
| quiz_type | TEXT NOT NULL CHECK IN ('pre','post') | |
| total_questions | INTEGER NOT NULL | |
| correct_count | INTEGER DEFAULT 0 | |
| score | INTEGER DEFAULT 0 | persen 0–100 |
| started_at | TEXT | ISO dari client |
| submitted_at | TEXT NULL | diisi saat grading |

Index: `idx_attempts_course`, `idx_attempts_lesson`, `idx_attempts_student`.

### attempt_answers
| Kolom | Tipe | Ket |
|---|---|---|
| id | SERIAL PK | |
| attempt_id | INTEGER FK → quiz_attempts.id ON DELETE CASCADE | |
| question_id | INTEGER FK → questions.id ON DELETE CASCADE | |
| selected_index | INTEGER NOT NULL | pilihan peserta (-1 = kosong) |
| is_correct | INTEGER DEFAULT 0 | hasil grading server |

Index: `idx_answers_attempt`.

### students
| Kolom | Tipe | Ket |
|---|---|---|
| id | SERIAL PK | |
| name | TEXT NOT NULL | |
| email | TEXT DEFAULT '' | unique index hanya jika tidak kosong |
| phone, external_ref | TEXT DEFAULT '' | |

Siswa dibuat otomatis saat submit quiz pertama (`ensureStudentWith`, case-insensitive name match).

### enrollments
Tabel skema lama — ada di DB tapi **tidak dipakai aplikasi saat ini** (student_id, course_slug, status, lessons_completed).

### settings
Key-value (`key` TEXT PK, `value` TEXT). Isi saat ini:
- `quiz_question_count` = "10" (legacy per-course; tidak lagi dipakai quiz per-lesson)
- `quiz_pass_threshold` = "70"
- `quiz_timer_minutes` = "20"

### ai_models (fitur AI tutor, 2026-08-12)
| Kolom | Tipe | Ket |
|---|---|---|
| id | SERIAL PK | |
| name | TEXT NOT NULL | nama tampilan di dropdown user |
| model_id | TEXT NOT NULL | id model untuk API provider |
| base_url | TEXT DEFAULT 'https://api.openai.com/v1' | kosong → fallback env `AI_BASE_URL` |
| api_key | TEXT DEFAULT '' | kosong → fallback env `AI_API_KEY`; **jangan pernah kirim ke client** |
| description | TEXT DEFAULT '' | |
| enabled | INTEGER DEFAULT 1 | hanya yang enabled tampil ke user |
| is_default | INTEGER DEFAULT 0 | hanya boleh 1 (di-reset via transaksi saat set) |

## Migrasi yang pernah dijalankan

| Script | Tanggal | Isi |
|---|---|---|
| `init-db.mjs` | 2026-08-08 | skema awal (versi SQLite → PostgreSQL) |
| `migrate-from-sqlite.mjs` | 2026-08-08 | migrasi data SQLite → Neon |
| `migrate-to-lesson-quiz.mjs` | 2026-08-11 | tambah `lesson_id` di questions & quiz_attempts + backfill 128 soal |
| (inline, 2026-08-12) | 2026-08-12 | tabel `ai_models` (sudah termasuk di init-db.mjs) |

Semua script idempotent — aman dijalankan ulang.
