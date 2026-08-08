import { postgresqlTable, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

// Courses table - same as before but using PostgreSQL types
export const courses = postgresqlTable("courses", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nameId: text("name_id").notNull(),
  nameEn: text("name_en"),
  descriptionId: text("description_id"),
  descriptionEn: text("description_en"),
  coverImage: text("cover_image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Lessons table
export const lessons = postgresqlTable("lessons", {
  id: text("id").primaryKey(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  slug: text("slug").notNull(),
  nameId: text("name_id").notNull(),
  number: integer("number").notNull(),
  order: integer("order").notNull(),
  durationMinutes: integer("duration_minutes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Questions table with all fields for quiz functionality
export const questions = postgresqlTable("questions", {
  id: text("id").primaryKey(),
  lessonId: text("lesson_id")
    .notNull()
    .references(() => lessons.id),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  questionTextId: text("question_text_id").notNull(),
  questionTextEn: text("question_text_en"),
  type: text("type").notNull(), // 'choice' | 'fill_blank'
  isCorrectIndexSelected: boolean("is_correct_index_selected").default(false),
  correctIndex: integer("correct_index"), // For choice type (1-based)
  explanationId: text("explanation_id"),
  explanationEn: text("explanation_en"),
  points: integer("points").default(10).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Quiz attempts table
export const quizAttempts = postgresqlTable("quiz_attempts", {
  id: text("id").primaryKey(),
  courseId: text("course_id")
    .notNull()
    .references(() => courses.id),
  studentName: text("student_name").notNull(),
  studentEmail: text("student_email"),
  type: text("type").notNull(), // 'pre' | 'post'
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  passed: boolean("passed").notNull(),
  completedAt: timestamp("completed_at").notNull().defaultNow(),
  timeSpentMinutes: integer("time_spent_minutes"),
});

// Answers table to store each answer attempt
export const answers = postgresqlTable("answers", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id")
    .notNull()
    .references(() => quizAttempts.id),
  questionId: text("question_id")
    .notNull()
    .references(() => questions.id),
  userAnswerIndex: integer("user_answer_index"),
  isCorrect: boolean("is_correct").notNull(),
  selectedOptions: text("selected_options"), // JSON array for multi-select
});
