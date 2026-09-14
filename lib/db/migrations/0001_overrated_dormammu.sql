CREATE TABLE "comparison_run_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"scan_order" integer NOT NULL,
	"quiz_code" text NOT NULL,
	"student_number" text NOT NULL,
	"teacher_last_name" text NOT NULL,
	"answers_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ai_quiz_code" text,
	"ai_student_number" text,
	"ai_teacher_last_name" text,
	"ai_answers_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quiz_code_match" boolean NOT NULL,
	"student_number_match" boolean NOT NULL,
	"teacher_name_match" boolean NOT NULL,
	"answer_match_count" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"ground_truth_score" numeric NOT NULL,
	"ai_score" numeric,
	"score_match" boolean NOT NULL,
	"would_have_been_clean" boolean NOT NULL,
	"false_clean" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comparison_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "comparison_run_items" ADD CONSTRAINT "comparison_run_items_run_id_comparison_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."comparison_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comparison_run_items_run_id_idx" ON "comparison_run_items" USING btree ("run_id");