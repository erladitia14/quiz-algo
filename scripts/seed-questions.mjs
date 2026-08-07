/**
 * Seed bank soal dari data/question-bank/*.json ke quiz.db.
 * Idempotent: soal lama dihapus per course lalu di-insert ulang.
 */
import Database from "better-sqlite3";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dbPath = path.join(root, "data", "quiz.db");
const bankDir = path.join(root, "data", "question-bank");

const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

let total = 0;
const files = readdirSync(bankDir).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const bank = JSON.parse(readFileSync(path.join(bankDir, file), "utf8"));
  const courseSlug = bank.course;

  const course = db
    .prepare("SELECT slug FROM courses WHERE slug = ?")
    .get(courseSlug);
  if (!course) {
    console.warn(`Course ${courseSlug} belum ada di DB — lewati ${file}`);
    continue;
  }

  db.prepare("DELETE FROM questions WHERE course_slug = ?").run(courseSlug);
  const insert = db.prepare(
    `INSERT INTO questions (course_slug, lesson_ref, module_ref, question, options, correct_index, explanation, difficulty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  let count = 0;
  for (const q of bank.questions) {
    if (
      !q.question ||
      !Array.isArray(q.options) ||
      q.options.length < 2 ||
      typeof q.correct_index !== "number" ||
      q.correct_index < 0 ||
      q.correct_index >= q.options.length
    ) {
      console.warn(`Soal tidak valid dilewati di ${file}:`, q.question);
      continue;
    }
    insert.run(
      courseSlug,
      q.lesson_ref || "",
      q.module_ref || "",
      q.question,
      JSON.stringify(q.options),
      q.correct_index,
      q.explanation || "",
      q.difficulty || "easy",
    );
    count++;
  }
  console.log(`${courseSlug}: ${count} soal`);
  total += count;
}

const inDb = db.prepare("SELECT COUNT(*) c FROM questions").get().c;
db.close();
console.log(`Total di-seed: ${total} | Total di DB: ${inDb}`);
