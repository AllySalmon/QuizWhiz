ALTER TABLE "audit_log" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "batches" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "book_reports" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "test_records" ADD COLUMN "user_id" uuid;