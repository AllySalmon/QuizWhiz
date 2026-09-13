-- Run once in the Supabase SQL editor (or via `supabase db execute`) after
-- the project is created. Not managed by Drizzle: storage.buckets lives in
-- Supabase's own "storage" schema, separate from the app schema in
-- lib/db/schema.ts.
--
-- Per project decision: the scan-images bucket is PRIVATE, server-side
-- access only. `public = false` means no anonymous/public URL access at
-- all — every read/write goes through the service-role client
-- (lib/supabase/admin.ts) from a Route Handler or Server Action, never
-- directly from the browser. No storage.objects RLS policies are added
-- for the anon/authenticated role on purpose: the service role bypasses
-- RLS entirely, and we don't want any other path in.

insert into storage.buckets (id, name, public)
values ('scan-images', 'scan-images', false)
on conflict (id) do nothing;
