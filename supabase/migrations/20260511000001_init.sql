-- SkillBias initial schema
-- Translates the Mongoose models (Organization, Job, Application) into Postgres,
-- adds RLS for multi-tenant isolation, and provisions the resumes storage bucket.

set search_path = public;

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- updated_at helper
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- organizations
-- One row per signed-up company. PK is the auth.users id; Supabase Auth handles
-- email/password/Google so those columns are gone from the Mongo schema.
-- ----------------------------------------------------------------------------
create table public.organizations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text not null check (length(company_name) > 0),
  logo text not null default '',
  description text not null default '',
  website text not null default '',

  plan text not null default 'free' check (plan in ('free', 'starter', 'pro')),
  free_job_used boolean not null default false,
  subscription_status text not null default 'none'
    check (subscription_status in ('active', 'canceled', 'trialing', 'past_due', 'none')),
  current_period_end timestamptz,
  stripe_customer_id text not null default '',
  stripe_subscription_id text not null default '',

  auto_shortlist_enabled boolean not null default false,
  auto_shortlist_threshold int not null default 80
    check (auto_shortlist_threshold between 0 and 100),
  auto_reject_enabled boolean not null default false,
  auto_reject_threshold int not null default 30
    check (auto_reject_threshold between 0 and 100),

  default_scoring_weights jsonb not null default
    '{"skills":40,"experience":25,"format":15,"answers":20}'::jsonb,
  default_job_is_public boolean not null default false,

  ai_provider text not null default 'skillbias'
    check (ai_provider in ('skillbias', 'anthropic', 'openai', 'groq', 'custom')),
  ai_model text not null default '',
  ai_api_key text not null default '', -- TODO: encrypt at rest before production (KMS + AES-GCM)
  ai_custom_url text not null default '',
  ai_custom_auth_header text not null default '',

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger organizations_set_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- jobs
-- ----------------------------------------------------------------------------
create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(user_id) on delete cascade,
  title text not null check (length(title) > 0),
  description text not null check (length(description) > 0),
  requirements text not null default '',
  required_skills text[] not null default '{}',
  posting_date timestamptz not null default timezone('utc', now()),
  end_date timestamptz not null,
  form_fields jsonb not null default '[]'::jsonb,
  scoring_weights jsonb not null default
    '{"skills":40,"experience":25,"format":15,"answers":20}'::jsonb,
  status text not null default 'active' check (status in ('active', 'closed')),
  is_public boolean not null default false,
  apply_link text not null unique,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index jobs_org_id_idx on public.jobs (org_id);
create index jobs_active_public_idx on public.jobs (is_public) where status = 'active';

create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- applications
-- agent_traces is reserved for Phase 5 multi-agent scoring output; defaults to {}
-- so existing single-shot scoring keeps working unchanged.
-- ----------------------------------------------------------------------------
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  email text not null check (length(email) > 0),
  answers jsonb not null default '{}'::jsonb,
  resume_url text not null,
  resume_analysis jsonb not null default '{}'::jsonb,
  score numeric(5,2) not null default 0 check (score between 0 and 100),
  ai_feedback text not null default '',
  status text not null default 'pending'
    check (status in ('applied', 'shortlisted', 'rejected', 'pending')),
  notes text not null default '',
  agent_traces jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index applications_job_email_unique
  on public.applications (job_id, lower(email));
create index applications_job_id_idx on public.applications (job_id);
create index applications_status_idx on public.applications (status);
create index applications_score_desc_idx on public.applications (score desc);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-create an organizations row when a new auth user signs up.
-- company_name comes from raw_user_meta_data.company_name (set on signup) or
-- falls back to the email local-part.
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.organizations (user_id, company_name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'company_name', ''),
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.organizations enable row level security;
alter table public.jobs           enable row level security;
alter table public.applications   enable row level security;

-- organizations: each org reads/updates only its own row
create policy "organizations: owner reads own row"
  on public.organizations for select
  using (auth.uid() = user_id);

create policy "organizations: owner updates own row"
  on public.organizations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- jobs: owner full CRUD; anyone can read public + active jobs
create policy "jobs: owner full access"
  on public.jobs for all
  to authenticated
  using (auth.uid() = org_id)
  with check (auth.uid() = org_id);

create policy "jobs: public reads active+public"
  on public.jobs for select
  to anon, authenticated
  using (is_public = true and status = 'active');

-- applications: owner reads/updates/deletes; INSERT goes through the service-role
-- key in the public-apply API route so we can run scoring atomically.
create policy "applications: owner selects"
  on public.applications for select
  to authenticated
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id and jobs.org_id = auth.uid()
    )
  );

create policy "applications: owner updates"
  on public.applications for update
  to authenticated
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id and jobs.org_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id and jobs.org_id = auth.uid()
    )
  );

create policy "applications: owner deletes"
  on public.applications for delete
  to authenticated
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = applications.job_id and jobs.org_id = auth.uid()
    )
  );

-- ----------------------------------------------------------------------------
-- Storage: resumes bucket (private; access via signed URLs minted server-side)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
  values ('resumes', 'resumes', false)
  on conflict (id) do nothing;

create policy "resumes: org owner reads own files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and exists (
      select 1
      from public.applications a
      join public.jobs j on j.id = a.job_id
      where a.resume_url = name
        and j.org_id = auth.uid()
    )
  );
