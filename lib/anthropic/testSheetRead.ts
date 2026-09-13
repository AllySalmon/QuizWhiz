import "server-only";
import { z } from "zod";
import { getAnthropicClient, GRADING_MODEL } from "./client";

// Matches Docs/3-Tech-Stack.md §3 (resolved): ONE call per test image.
// The answer key is never sent here — this call's only job is *reading* the
// sheet (quiz code, student number, teacher last name, circled answers) plus
// a confidence flag per field. Scoring against the stored key happens
// afterward, in QuizWhiz's own deterministic code (Milestone 1), not here.

const confidence = z.enum(["high", "low"]);

export const TestSheetReadSchema = z.object({
  quizCode: z.object({ value: z.string().nullable(), confidence }),
  studentNumber: z.object({ value: z.string().nullable(), confidence }),
  teacherLastName: z.object({ value: z.string().nullable(), confidence }),
  answers: z.array(
    z.object({
      questionNumber: z.number().int().positive(),
      selected: z.enum(["A", "B", "C", "D"]).nullable(),
      confidence,
    })
  ),
});

export type TestSheetRead = z.infer<typeof TestSheetReadSchema>;

const TOOL_NAME = "record_test_sheet_read";

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
    studentNumber: {
      type: "object",
      properties: {
        value: { type: ["string", "null"], description: "The student number as written. Never a student name." },
        confidence: { type: "string", enum: ["high", "low"] },
      },
      required: ["value", "confidence"],
    },
    teacherLastName: {
      type: "object",
      properties: {
        value: {
          type: ["string", "null"],
          description:
            "The handwritten teacher last name exactly as written, including any title/honorific prefix (Mr., Mrs., Ms., Miss) if present — do not strip it.",
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
          selected: { type: ["string", "null"], enum: ["A", "B", "C", "D", null] },
          confidence: { type: "string", enum: ["high", "low"] },
        },
        required: ["questionNumber", "selected", "confidence"],
      },
    },
  },
  required: ["quizCode", "studentNumber", "teacherLastName", "answers"],
};

const SYSTEM_PROMPT = `You are reading a scanned/photographed paper reading-quiz answer sheet for a K-5 school library program (SSYRA).

Report exactly what is on the sheet — do not guess or infer a value you can't clearly read. If a field is unreadable, ambiguous, smudged, or has more than one answer circled for a question, set its value to null and confidence to "low" rather than picking your best guess. A wrong silent read is worse than an honest "low confidence."

For the teacher's last name: if the sheet has a title/honorific (Mr., Mrs., Ms., Miss, or similar) written before the name, include it verbatim in the value — do not strip it. That detection matters downstream.

Never attempt to read or report a student's name — these sheets should not have one, and if handwriting resembling a name appears where the student number belongs, treat the number as unreadable (null, low confidence) rather than reporting a name.`;

export async function readTestSheet(params: {
  imageBase64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}): Promise<TestSheetRead> {
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
            text: "Read this test sheet and call the tool with the result.",
          },
        ],
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: "Record the structured read of one test sheet.",
        input_schema: TOOL_INPUT_SCHEMA,
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
  });

  const toolUse = message.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude did not return a tool_use block for the test sheet read.");
  }

  return TestSheetReadSchema.parse(toolUse.input);
}
