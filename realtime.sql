-- Run this AFTER the table/policies you already created.
-- This enables live updates for the DJ queue.
alter publication supabase_realtime add table public.requests;
