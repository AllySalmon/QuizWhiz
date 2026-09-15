ALTER TABLE "answer_key_questions" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "answer_keys" ADD COLUMN "user_id" uuid;