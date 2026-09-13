CREATE TYPE "public"."answer_choice" AS ENUM('A', 'B', 'C', 'D');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('clean', 'needs_assignment_review', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."book_report_status" AS ENUM('outstanding', 'received');--> statement-breakpoint
CREATE TYPE "public"."grade_band" AS ENUM('jr', '3-5');--> statement-breakpoint
CREATE TYPE "public"."grading_status" AS ENUM('clean', 'needs_grading_review', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('photo', 'pdf');--> statement-breakpoint
CREATE TABLE "answer_key_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"answer_key_id" uuid NOT NULL,
	"question_number" integer NOT NULL,
	"correct_answer" "answer_choice" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "answer_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_code" text NOT NULL,
	"book_title" text NOT NULL,
	"grade_band" "grade_band" NOT NULL,
	"question_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answer_keys_quiz_code_unique" UNIQUE("quiz_code")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"label" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"item_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"test_record_id" uuid NOT NULL,
	"student_number" text NOT NULL,
	"teacher_id" uuid,
	"due_date" date NOT NULL,
	"status" "book_report_status" DEFAULT 'outstanding' NOT NULL,
	"received_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_roster" (
	"student_number" text PRIMARY KEY NOT NULL,
	"teacher_id" uuid,
	"grade_band" "grade_band" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "test_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"scan_order" integer NOT NULL,
	"quiz_code" text,
	"student_number" text,
	"ocr_teacher_last_name" text,
	"resolved_teacher_id" uuid,
	"answers_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"score_percent" numeric,
	"passed" boolean,
	"grading_status" "grading_status" DEFAULT 'clean' NOT NULL,
	"assignment_status" "assignment_status" DEFAULT 'clean' NOT NULL,
	"flag_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scan_image_ref" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answer_key_questions" ADD CONSTRAINT "answer_key_questions_answer_key_id_answer_keys_id_fk" FOREIGN KEY ("answer_key_id") REFERENCES "public"."answer_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_reports" ADD CONSTRAINT "book_reports_test_record_id_test_records_id_fk" FOREIGN KEY ("test_record_id") REFERENCES "public"."test_records"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_reports" ADD CONSTRAINT "book_reports_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_roster" ADD CONSTRAINT "student_roster_teacher_id_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_records" ADD CONSTRAINT "test_records_batch_id_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "test_records" ADD CONSTRAINT "test_records_resolved_teacher_id_teachers_id_fk" FOREIGN KEY ("resolved_teacher_id") REFERENCES "public"."teachers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "answer_key_questions_key_question_unique" ON "answer_key_questions" USING btree ("answer_key_id","question_number");--> statement-breakpoint
CREATE INDEX "book_reports_status_due_date_idx" ON "book_reports" USING btree ("status","due_date");--> statement-breakpoint
CREATE INDEX "test_records_student_number_idx" ON "test_records" USING btree ("student_number");--> statement-breakpoint
CREATE INDEX "test_records_quiz_code_idx" ON "test_records" USING btree ("quiz_code");--> statement-breakpoint
CREATE INDEX "test_records_status_idx" ON "test_records" USING btree ("grading_status","assignment_status");--> statement-breakpoint
CREATE INDEX "test_records_batch_id_idx" ON "test_records" USING btree ("batch_id");