-- Enable Supabase Realtime broadcasts on the applications table so the
-- dashboard / candidates UI can subscribe to score updates without polling.
-- RLS still applies — subscribers only see events for rows their policies allow.
alter publication supabase_realtime add table public.applications;
