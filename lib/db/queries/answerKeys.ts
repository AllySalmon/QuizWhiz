import "server-only";
import { createClient } from "@/lib/supabase/server";

export type AnswerChoice = "A" | "B" | "C" | "D";
export type GradeBand = "jr" | "3-5";

// Multi-tenant proof of concept: this file queries through the Supabase
// client (PostgREST), not Drizzle — the Drizzle connection's Postgres role
// has rolbypassrls=true (confirmed live), so RLS has zero effect on
// anything read through it. Only the Supabase client's anon/authenticated
// role actually gets scoped by the "owner has full access" policies in
// supabase/answer-keys-rls.sql. See the approved plan for the full picture
// (including why quiz_code stays globally unique for now).
//
// PostgREST alias syntax (`alias:column`) keeps every returned shape
// identical to what Drizzle's camelCase auto-mapping produced — none of
// this file's callers should need to change. One real difference:
// createdAt/updatedAt come back as ISO strings here, not Date objects
// (Drizzle converted those; PostgREST doesn't) — typed as `string` below
// to reflect that honestly rather than casting past it.

type AnswerKeyRow = {
  id: string;
  userId: string;
  quizCode: string;
  bookTitle: string;
  gradeBand: GradeBand;
  questionCount: number;
  createdAt: string;
  updatedAt: string;
};

type AnswerKeyQuestionRow = {
  id: string;
  answerKeyId: string;
  questionNumber: number;
  correctAnswer: AnswerChoice;
};

const KEY_COLUMNS =
  "id, userId:user_id, quizCode:quiz_code, bookTitle:book_title, gradeBand:grade_band, questionCount:question_count, createdAt:created_at, updatedAt:updated_at";
const QUESTION_COLUMNS = "id, answerKeyId:answer_key_id, questionNumber:question_number, correctAnswer:correct_answer";

export async function listAnswerKeys() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("answer_keys")
    .select(KEY_COLUMNS)
    .order("book_title", { ascending: true })
    .returns<AnswerKeyRow[]>();
  if (error) throw error;
  return data;
}

export async function getAnswerKeyWithQuestions(id: string) {
  const supabase = await createClient();
  const { data: key, error } = await supabase
    .from("answer_keys")
    .select(KEY_COLUMNS)
    .eq("id", id)
    .maybeSingle<AnswerKeyRow>();
  if (error) throw error;
  if (!key) return null;

  const { data: questions, error: qError } = await supabase
    .from("answer_key_questions")
    .select(QUESTION_COLUMNS)
    .eq("answer_key_id", id)
    .order("question_number", { ascending: true })
    .returns<AnswerKeyQuestionRow[]>();
  if (qError) throw qError;

  return { ...key, questions: questions ?? [] };
}

// Looked up once per graded image, by the quiz code read off the sheet
// (case-insensitive, trimmed — handwriting/print variance shouldn't cause
// an otherwise-correct code to miss).
export async function getAnswerKeyByQuizCode(quizCode: string) {
  const supabase = await createClient();
  const { data: key, error } = await supabase
    .from("answer_keys")
    .select(KEY_COLUMNS)
    .ilike("quiz_code", quizCode.trim())
    .maybeSingle<AnswerKeyRow>();
  if (error) throw error;
  if (!key) return null;

  const { data: questions, error: qError } = await supabase
    .from("answer_key_questions")
    .select(QUESTION_COLUMNS)
    .eq("answer_key_id", key.id)
    .order("question_number", { ascending: true })
    .returns<AnswerKeyQuestionRow[]>();
  if (qError) throw qError;

  return { ...key, questions: questions ?? [] };
}

// user_id is never set explicitly on insert — both tables default it to
// auth.uid() at the column level (supabase/answer-keys-rls.sql).
//
// Not fully atomic: inserting the key and inserting its questions are two
// separate statements (the Supabase client has no multi-statement
// transaction primitive short of a Postgres RPC, deliberately not
// introduced for this narrow proof). A failed questions insert triggers a
// best-effort cleanup delete of the key. Acceptable here — a crash between
// the two steps leaves an orphaned, harmless, re-editable answer key, not
// corrupted data. Explicitly NOT the pattern to reuse for test_records/
// book_reports later (see the plan's "flagged for later" section).
export async function createAnswerKey(input: {
  quizCode: string;
  bookTitle: string;
  gradeBand: GradeBand;
  questions: { questionNumber: number; correctAnswer: AnswerChoice }[];
}) {
  const supabase = await createClient();

  const { data: key, error } = await supabase
    .from("answer_keys")
    .insert({
      quiz_code: input.quizCode,
      book_title: input.bookTitle,
      grade_band: input.gradeBand,
      question_count: input.questions.length,
    })
    .select(KEY_COLUMNS)
    .single<AnswerKeyRow>();
  if (error) throw error;

  if (input.questions.length > 0) {
    const { error: qError } = await supabase.from("answer_key_questions").insert(
      input.questions.map((q) => ({
        answer_key_id: key.id,
        question_number: q.questionNumber,
        correct_answer: q.correctAnswer,
      }))
    );
    if (qError) {
      await supabase.from("answer_keys").delete().eq("id", key.id);
      throw qError;
    }
  }

  return key;
}

// Replaces the full question set on save. In Milestone 1b this is where a
// "N tests used this key — recompute their scores?" confirmation hooks in
// (Docs/1-PRD.md §5.1) — no test_records exist yet for this to affect.
export async function updateAnswerKey(
  id: string,
  input: {
    bookTitle: string;
    gradeBand: GradeBand;
    questions: { questionNumber: number; correctAnswer: AnswerChoice }[];
  }
) {
  const supabase = await createClient();

  const { data: key, error } = await supabase
    .from("answer_keys")
    .update({
      book_title: input.bookTitle,
      grade_band: input.gradeBand,
      question_count: input.questions.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(KEY_COLUMNS)
    .single<AnswerKeyRow>();
  if (error) throw error;

  const { error: delError } = await supabase.from("answer_key_questions").delete().eq("answer_key_id", id);
  if (delError) throw delError;

  if (input.questions.length > 0) {
    const { error: qError } = await supabase.from("answer_key_questions").insert(
      input.questions.map((q) => ({
        answer_key_id: id,
        question_number: q.questionNumber,
        correct_answer: q.correctAnswer,
      }))
    );
    if (qError) throw qError;
  }

  return key;
}

export async function listQuizCodes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("answer_keys")
    .select("quizCode:quiz_code")
    .returns<{ quizCode: string }[]>();
  if (error) throw error;
  return (data ?? []).map((r) => r.quizCode);
}

// For the accuracy pilot's ground-truth CSV validation (lib/csv/groundTruthImport.ts)
// — each row's required answer columns depend on its own quiz code's real
// question count, not a count assumed from the CSV's header alone.
export async function listQuizCodeQuestionCounts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("answer_keys")
    .select("quizCode:quiz_code, questionCount:question_count")
    .returns<{ quizCode: string; questionCount: number }[]>();
  if (error) throw error;
  return data ?? [];
}

// Used by the CSV import (lib/csv/answerKeyImport.ts) after it has already
// filtered out invalid/duplicate rows. Each key gets its own createAnswerKey
// call — fine at CSV-batch scale, no need for one giant transaction.
export async function createManyAnswerKeys(
  rows: {
    quizCode: string;
    bookTitle: string;
    gradeBand: GradeBand;
    questions: { questionNumber: number; correctAnswer: AnswerChoice }[];
  }[]
) {
  for (const row of rows) {
    await createAnswerKey(row);
  }
  return rows.length;
}

export async function answerKeysExist() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("answer_keys").select("id").limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}
