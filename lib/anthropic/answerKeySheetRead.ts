import "server-only";
import { z } from "zod";
import { getAnthropicClient, GRADING_MODEL } from "./client";

// Mirrors testSheetRead.ts's shape (per-field {value, confidence}, one tool
// call, never guess), but reads a librarian's answer key sheet — the
// correct-answer list for one quiz — not a completed student test.

const confidence = z.enum(["high", "low"]);

export const AnswerKeySheetReadSchema = z.object({
  quizCode: z.object({ value: z.string().nullable(), confidence }),
  bookTitle: z.object({ value: z.string().nullable(), confidence }),
  gradeBand: z.object({ value: z.enum(["jr", "3-5"]).nullable(), confidence }),
  answers: z.array(
    z.object({
      questionNumber: z.number().int().positive(),
      correctAnswer: z.enum(["A", "B", "C", "D"]).nullable(),
      confidence,
    })
  ),
});

export type AnswerKeySheetRead = z.infer<typeof AnswerKeySheetReadSchema>;

const TOOL_NAME = "record_answer_key_sheet_read";

const TOOL_INPUT_SCHEMA = {
  type: "object" as const,
  properties: {
    quizCode: {
      type: "object",
      properties: {
        value: { type: ["string", "null"], description: "The quiz/book code printed on the sheet, exactly as written." },
        confidence: { type: "string", enum: ["high", "low"] },
      },
      required: ["value", "confidence"],
    },
    bookTitle: {
      type: "object",
      properties: {
        value: { type: ["string", "null"], description: "The book title this answer key is for, exactly as written." },
        confidence: { type: "string", enum: ["high", "low"] },
      },
      required: ["value", "confidence"],
    },
    gradeBand: {
      type: "object",
      properties: {
        value: {
          type: ["string", "null"],
          enum: ["jr", "3-5", null],
          description:
            "SSYRA grade band if explicitly marked on the sheet (Jr. or 3-5) — do not infer this from the book title or question count if it isn't actually written down.",
        },
        confidence: { type: "string", enum: ["high", "low"] },
      },
      required: ["value", "confidence"],
    },
    answers: {
      type: "array",
      description: "One entry per question on the sheet, in question order.",
      items: {
        type: "object",
        properties: {
          questionNumber: { type: "integer" },
          correctAnswer: { type: ["string", "null"], enum: ["A", "B", "C", "D", null] },
          confidence: { type: "string", enum: ["high", "low"] },
        },
        required: ["questionNumber", "correctAnswer", "confidence"],
      },
    },
  },
  required: ["quizCode", "bookTitle", "gradeBand", "answers"],
};

const SYSTEM_PROMPT = `You are reading a librarian's answer key sheet for a K-5 school reading-quiz program (SSYRA) — this lists the correct answer for each question on one quiz. It is not a completed student test, so there is no student number, teacher name, or circled-by-a-student handwriting to read.

Report exactly what is on the sheet — do not guess or infer a value you can't clearly read. If a field is unreadable, ambiguous, or simply not present on the sheet, set its value to null and confidence to "low" rather than picking your best guess. A wrong silent read is worse than an honest "low confidence."

The grade band in particular often is not marked on an answer key sheet at all — only report it if it's explicitly written (e.g. "Jr." or "3-5"), never inferred from the book title, reading level, or number of questions.`;

export async function readAnswerKeySheet(params: {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}): Promise<AnswerKeySheetRead> {
  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: GRADING_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: params.mediaType,
              data: params.imageBase64,
            },
          },
          {
            type: "text",
            text: "Read this answer key sheet and call the tool with the result.",
          },
        ],
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: "Record the structured read of one answer key sheet.",
        input_schema: TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block for the answer key sheet read.");
  }

  return AnswerKeySheetReadSchema.parse(toolUse.input);
}
