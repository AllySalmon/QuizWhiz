import "server-only";
import { eq, asc, sql } from "drizzle-orm";
import { getDb } from "../client";
import { comparisonRuns, comparisonRunItems } from "../schema";

export async function createRun(label: string) {
  const db = getDb();
  const [run] = await db.insert(comparisonRuns).values({ label }).returning();
  return run;
}

export async function getRun(id: string) {
  const db = getDb();
  const [run] = await db.select().from(comparisonRuns).where(eq(comparisonRuns.id, id));
  return run ?? null;
}

export async function listRuns() {
  const db = getDb();
  return db.select().from(comparisonRuns).orderBy(sql`${comparisonRuns.createdAt} desc`);
}

export type NewRunItem = {
  runId: string;
  scanOrder: number;
  scanImageRef: string | null;
  quizCode: string;
  studentNumber: string;
  teacherLastName: string;
  answersJson: Record<string, string>;
  aiQuizCode: string | null;
  aiStudentNumber: string | null;
  aiTeacherLastName: string | null;
  aiAnswersJson: Record<string, string | null>;
  quizCodeMatch: boolean;
  studentNumberMatch: boolean;
  teacherNameMatch: boolean;
  answerMatchCount: number;
  totalQuestions: number;
  groundTruthScore: number;
  aiScore: number | null;
  scoreMatch: boolean;
  wouldHaveBeenClean: boolean;
  falseClean: boolean;
};

export async function createRunItem(input: NewRunItem) {
  const db = getDb();
  const [item] = await db
    .insert(comparisonRunItems)
    .values({
      ...input,
      groundTruthScore: input.groundTruthScore.toString(),
      aiScore: input.aiScore?.toString() ?? null,
    })
    .returning();
  return item;
}

export async function listRunItems(runId: string) {
  const db = getDb();
  return db
    .select()
    .from(comparisonRunItems)
    .where(eq(comparisonRunItems.runId, runId))
    .orderBy(asc(comparisonRunItems.scanOrder));
}

export async function getRunItem(id: string) {
  const db = getDb();
  const [item] = await db.select().from(comparisonRunItems).where(eq(comparisonRunItems.id, id));
  return item ?? null;
}

export async function getRunStats(runId: string) {
  const db = getDb();
  const items = await db.select().from(comparisonRunItems).where(eq(comparisonRunItems.runId, runId));

  const total = items.length;
  if (total === 0) {
    return {
      total: 0,
      quizCodeAccuracy: 0,
      studentNumberAccuracy: 0,
      teacherNameAccuracy: 0,
      answerAccuracy: 0,
      scoreMatchRate: 0,
      falseCleanCount: 0,
      falseCleanRate: 0,
    };
  }

  const totalAnswers = items.reduce((sum, i) => sum + i.totalQuestions, 0);
  const totalAnswerMatches = items.reduce((sum, i) => sum + i.answerMatchCount, 0);
  const falseCleanCount = items.filter((i) => i.falseClean).length;

  return {
    total,
    quizCodeAccuracy: (items.filter((i) => i.quizCodeMatch).length / total) * 100,
    studentNumberAccuracy: (items.filter((i) => i.studentNumberMatch).length / total) * 100,
    teacherNameAccuracy: (items.filter((i) => i.teacherNameMatch).length / total) * 100,
    answerAccuracy: totalAnswers > 0 ? (totalAnswerMatches / totalAnswers) * 100 : 0,
    scoreMatchRate: (items.filter((i) => i.scoreMatch).length / total) * 100,
    falseCleanCount,
    falseCleanRate: (falseCleanCount / total) * 100,
  };
}
