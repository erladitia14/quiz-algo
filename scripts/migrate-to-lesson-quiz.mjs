/**
 * Migrasi quiz per-course -> quiz per-lesson.
 *
 * 1. Tambah kolom lesson_id di questions & quiz_attempts.
 * 2. Backfill questions.lesson_id dari lesson_ref -> lessons.title
 *    (dengan normalisasi: kutip, prefix "Python.", spasi).
 * 3. Index pendukung.
 *
 * Idempotent: aman dijalankan berulang kali.
 *
 * Pemakaian: DATABASE_URL=postgresql://... node scripts/migrate-to-lesson-quiz.mjs
 * (di lokal DATABASE_URL diambil dari .env.local bila tidak diset manual)
 */
import pg from "pg";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function loadEnvFile(name) {
  const file = path.join(root, name);
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && process.env[match[1]] === undefined) {
      process.env[match[1]] = match[2];
    }
  }
}
loadEnvFile(".env.local");
loadEnvFile(".env.production");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL belum diset.");
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString,
  ssl: /^postgres(ql)?:\/\/[^@]*@(localhost|127\.0\.0\.1)/.test(connectionString)
    ? undefined
    : { rejectUnauthorized: false },
});

// ---------------------------------------------------------------------------
// 1. Skema
// ---------------------------------------------------------------------------
await pool.query(`
  ALTER TABLE questions ADD COLUMN IF NOT EXISTS lesson_id INTEGER REFERENCES lessons(id);
  ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS lesson_id INTEGER REFERENCES lessons(id);
  CREATE INDEX IF NOT EXISTS idx_questions_lesson ON questions(lesson_id);
  CREATE INDEX IF NOT EXISTS idx_attempts_lesson ON quiz_attempts(lesson_id);
`);
console.log("[1/3] Kolom lesson_id siap.");

// ---------------------------------------------------------------------------
// 2. Backfill questions.lesson_id
// ---------------------------------------------------------------------------

// Kasus khusus yang tidak bisa dicocokkan secara algoritmis.
const SPECIAL_MAP = {
  "the easy editor app. part 3": "easy editor application. part 3",
};

function norm(s) {
  return String(s)
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B']/g, '"')
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/^python\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

const lessons = (await pool.query("SELECT id, course_slug, title FROM lessons")).rows;
const lessonsByCourse = new Map();
for (const l of lessons) {
  if (!lessonsByCourse.has(l.course_slug)) lessonsByCourse.set(l.course_slug, []);
  lessonsByCourse.get(l.course_slug).push({ id: l.id, normTitle: norm(l.title) });
}

const questions = (
  await pool.query("SELECT id, course_slug, lesson_ref FROM questions WHERE lesson_id IS NULL")
).rows;

let matched = 0;
const unmatched = [];
for (const q of questions) {
  const candidates = lessonsByCourse.get(q.course_slug) || [];
  const refNorm = SPECIAL_MAP[norm(q.lesson_ref)] || norm(q.lesson_ref);

  let hits = candidates.filter((c) => c.normTitle === refNorm);
  if (hits.length === 0) {
    // Cocok prefix dua arah (ref adalah prefix judul lesson, atau sebaliknya)
    hits = candidates.filter(
      (c) => c.normTitle.startsWith(refNorm + ".") || refNorm.startsWith(c.normTitle + "."),
    );
  }
  if (hits.length === 0) {
    // Fallback terakhir: containment dua arah
    hits = candidates.filter(
      (c) => c.normTitle.includes(refNorm) || refNorm.includes(c.normTitle),
    );
  }

  if (hits.length === 1) {
    await pool.query("UPDATE questions SET lesson_id = $1 WHERE id = $2", [
      hits[0].id,
      q.id,
    ]);
    matched++;
  } else {
    unmatched.push({ id: q.id, course: q.course_slug, ref: q.lesson_ref, hits: hits.length });
  }
}
console.log(`[2/3] Backfill: ${matched} soal ter-match, ${unmatched.length} gagal.`);
if (unmatched.length > 0) {
  console.warn("Soal tanpa lesson (perlu dicek manual):");
  for (const u of unmatched) {
    console.warn(`  - #${u.id} [${u.course}] "${u.ref}" (kandidat: ${u.hits})`);
  }
}

// ---------------------------------------------------------------------------
// 3. Laporan
// ---------------------------------------------------------------------------
const summary = await pool.query(`
  SELECT c.slug AS course,
         COUNT(DISTINCT l.id) FILTER (WHERE l.id IN (SELECT lesson_id FROM questions))::int AS lessons_with_questions,
         COUNT(l.id)::int AS total_lessons,
         COUNT(DISTINCT q.id) FILTER (WHERE q.lesson_id IS NOT NULL)::int AS mapped_questions,
         COUNT(DISTINCT q.id) FILTER (WHERE q.lesson_id IS NULL)::int AS unmapped_questions
  FROM courses c
  LEFT JOIN lessons l ON l.course_slug = c.slug
  LEFT JOIN questions q ON q.course_slug = c.slug
  GROUP BY c.slug ORDER BY c.slug
`);
console.log("[3/3] Ringkasan:");
for (const r of summary.rows) {
  console.log(
    `  ${r.course}: ${r.mapped_questions}/${r.mapped_questions + r.unmapped_questions} soal terpetakan, ` +
      `${r.lessons_with_questions}/${r.total_lessons} lesson punya quiz`,
  );
}

await pool.end();
console.log("Migrasi selesai OK");
