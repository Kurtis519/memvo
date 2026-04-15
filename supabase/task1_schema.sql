-- Memvo Task 1 Supabase schema scaffold
-- Apply in the Supabase SQL editor after confirming project ownership and backup posture.

create extension if not exists pgcrypto;

create type public.memvo_plan as enum ('free', 'pro', 'admin');
create type public.memvo_sync_status as enum ('pending', 'uploading', 'processing', 'complete', 'failed');
create type public.memvo_referral_status as enum ('pending', 'qualified', 'rewarded');

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  plan public.memvo_plan not null default 'free',
  is_admin boolean not null default false,
  referral_code text unique,
  referred_by_code text,
  referral_bonus_minutes integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  name text not null,
  slug text not null,
  kind text not null default 'custom',
  position integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique(user_id, slug)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  folder_id uuid references public.folders(id) on delete set null,
  title text not null default 'Untitled note',
  transcript text,
  summary text,
  action_items jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  audio_path text,
  duration_seconds integer,
  language_code text,
  sync_status public.memvo_sync_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  note_id uuid references public.notes(id) on delete set null,
  local_uri text not null,
  status public.memvo_sync_status not null default 'pending',
  retry_count integer not null default 0,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.user_profiles(id) on delete cascade,
  referred_user_id uuid references public.user_profiles(id) on delete set null,
  referral_code text not null,
  status public.memvo_referral_status not null default 'pending',
  rewarded_minutes integer not null default 0,
  bonus_minutes_awarded integer not null default 30,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.referrals
  add column if not exists bonus_minutes_awarded integer not null default 30;

create unique index if not exists referrals_referred_user_id_unique on public.referrals (referred_user_id)
where referred_user_id is not null;

create index if not exists user_profiles_referral_code_idx on public.user_profiles (referral_code);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.generate_referral_code_candidate()
returns text
language sql
as $$
  select 'MEMVO-' || string_agg(substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 1 + floor(random() * 36)::integer, 1), '')
  from generate_series(1, 6);
$$;

create or replace function public.generate_unique_referral_code()
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := public.generate_referral_code_candidate();
    exit when not exists (
      select 1
      from public.user_profiles
      where referral_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_admin_email text := lower(coalesce(current_setting('app.settings.memvo_admin_email', true), ''));
begin
  insert into public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    referral_code,
    is_admin,
    plan
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    public.generate_unique_referral_code(),
    case when lower(coalesce(new.email, '')) = configured_admin_email then true else false end,
    case when lower(coalesce(new.email, '')) = configured_admin_email then 'admin'::public.memvo_plan else 'free'::public.memvo_plan end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_memvo on auth.users;
create trigger on_auth_user_created_memvo
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

create or replace function public.seed_default_folders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.folders (user_id, name, slug, kind, position)
  values
    (new.id, 'All Notes', 'all-notes', 'system', 0),
    (new.id, 'Starred', 'starred', 'system', 1),
    (new.id, 'Meetings', 'meetings', 'system', 2),
    (new.id, 'Ideas', 'ideas', 'system', 3),
    (new.id, 'Journals', 'journals', 'system', 4)
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_user_profile_created_seed_folders on public.user_profiles;
create trigger on_user_profile_created_seed_folders
  after insert on public.user_profiles
  for each row execute procedure public.seed_default_folders();

create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute procedure public.set_updated_at();
create trigger set_folders_updated_at
  before update on public.folders
  for each row execute procedure public.set_updated_at();
create trigger set_notes_updated_at
  before update on public.notes
  for each row execute procedure public.set_updated_at();
create trigger set_sync_queue_updated_at
  before update on public.sync_queue
  for each row execute procedure public.set_updated_at();
create trigger set_referrals_updated_at
  before update on public.referrals
  for each row execute procedure public.set_updated_at();

alter table public.user_profiles enable row level security;
alter table public.folders enable row level security;
alter table public.notes enable row level security;
alter table public.sync_queue enable row level security;
alter table public.referrals enable row level security;

create policy "profiles_select_own" on public.user_profiles
for select using (auth.uid() = id or exists (
  select 1 from public.user_profiles admin_profile
  where admin_profile.id = auth.uid() and admin_profile.is_admin = true
));

create policy "profiles_update_own" on public.user_profiles
for update using (auth.uid() = id)
with check (auth.uid() = id);

create policy "folders_manage_own" on public.folders
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "notes_manage_own" on public.notes
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "sync_queue_manage_own" on public.sync_queue
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "referrals_select_own_or_admin" on public.referrals
for select using (
  auth.uid() = referrer_user_id
  or exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
);

create policy "referrals_insert_own" on public.referrals
for insert with check (auth.uid() = referrer_user_id);

create policy "referrals_admin_update" on public.referrals
for update using (
  exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
)
with check (
  exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
);

update public.user_profiles
set referral_code = public.generate_unique_referral_code()
where referral_code is null
  or referral_code !~ '^MEMVO-[A-Z0-9]{6}$';

create or replace function public.award_referral_bonus(
  input_referrer_code text,
  input_new_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_referrer_code text := upper(btrim(coalesce(input_referrer_code, '')));
  referrer_id uuid;
  new_user_id uuid;
  referral_bonus integer := 30;
  created_referral_id uuid;
begin
  if normalized_referrer_code = '' then
    return jsonb_build_object('success', false, 'error', 'Referral code is required.');
  end if;

  select id
  into referrer_id
  from public.user_profiles
  where referral_code = normalized_referrer_code
  limit 1;

  if referrer_id is null then
    return jsonb_build_object('success', false, 'error', 'Referral code not found.');
  end if;

  select id
  into new_user_id
  from public.user_profiles
  where id = input_new_user_id
  limit 1;

  if new_user_id is null then
    return jsonb_build_object('success', false, 'error', 'New user profile not found.');
  end if;

  if referrer_id = new_user_id then
    return jsonb_build_object('success', false, 'error', 'Self-referral is not allowed.');
  end if;

  if exists (
    select 1
    from public.referrals
    where referred_user_id = new_user_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Referral has already been processed for this user.');
  end if;

  insert into public.referrals (
    referrer_user_id,
    referred_user_id,
    referral_code,
    status,
    rewarded_minutes,
    bonus_minutes_awarded
  )
  values (
    referrer_id,
    new_user_id,
    normalized_referrer_code,
    'rewarded',
    referral_bonus,
    referral_bonus
  )
  returning id into created_referral_id;

  update public.user_profiles
  set bonus_minutes = public.user_profiles.bonus_minutes + referral_bonus,
      updated_at = timezone('utc', now())
  where id = referrer_id;

  update public.user_profiles
  set bonus_minutes = public.user_profiles.bonus_minutes + referral_bonus,
      referred_by_code = normalized_referrer_code,
      updated_at = timezone('utc', now())
  where id = new_user_id;

  return jsonb_build_object(
    'success', true,
    'referral_id', created_referral_id,
    'bonus_minutes_awarded', referral_bonus
  );
end;
$$;

comment on function public.handle_new_user_profile is 'Reads app.settings.memvo_admin_email to auto-assign the Memvo owner account admin access.';
comment on function public.award_referral_bonus is 'Awards Memvo referral bonus minutes exactly once for an eligible new user.';
comment on table public.sync_queue is 'Tracks offline recordings that still need upload, transcription, or retry handling.';

-- Task 4: Claude post-transcription note processing
create extension if not exists pg_net with schema extensions;

create type public.memvo_ai_processing_status as enum ('idle', 'processing', 'complete', 'failed', 'skipped');

alter table public.user_profiles
  add column if not exists manual_pro boolean not null default false,
  add column if not exists bonus_minutes integer not null default 0,
  add column if not exists minutes_used_this_month numeric not null default 0;

alter table public.notes
  add column if not exists action_items jsonb not null default '[]'::jsonb,
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists transcription_engine text,
  add column if not exists language_detected text,
  add column if not exists mood text,
  add column if not exists ai_processing_status public.memvo_ai_processing_status not null default 'idle',
  add column if not exists ai_error text,
  add column if not exists ai_processed_at timestamptz,
  add column if not exists recorded_at timestamptz not null default timezone('utc', now());

alter table public.sync_queue
  add column if not exists local_uri text,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists next_retry_at timestamptz,
  add column if not exists transcription_plan text;

comment on column public.notes.mood is 'Optional journal-style mood inferred by Claude after transcription.';
comment on column public.notes.ai_processing_status is 'Tracks whether Claude analysis is waiting, running, complete, failed, or skipped.';

alter table public.notes
  add column if not exists search_vector tsvector;

create or replace function public.notes_search_vector_update()
returns trigger
language plpgsql
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A')
    || setweight(to_tsvector('english', coalesce(new.transcript, '')), 'B')
    || setweight(to_tsvector('english', coalesce(new.summary, '')), 'B')
    || setweight(to_tsvector('english', coalesce((select string_agg(value::text, ' ') from jsonb_array_elements_text(coalesce(new.tags, '[]'::jsonb)) as value), '')), 'C');
  return new;
end;
$$;

drop trigger if exists notes_search_vector_before_write on public.notes;
create trigger notes_search_vector_before_write
  before insert or update of title, transcript, summary, tags on public.notes
  for each row execute procedure public.notes_search_vector_update();

update public.notes
set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A')
  || setweight(to_tsvector('english', coalesce(transcript, '')), 'B')
  || setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  || setweight(to_tsvector('english', coalesce((select string_agg(value::text, ' ') from jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) as value), '')), 'C')
where search_vector is null;

create index if not exists notes_search_vector_idx on public.notes using gin (search_vector);
create index if not exists notes_recorded_at_idx on public.notes (recorded_at desc);
create index if not exists notes_folder_id_idx on public.notes (folder_id);

create or replace function public.search_notes(
  search_term text,
  filter_tag text default null,
  filter_folder_id uuid default null,
  start_at timestamptz default null,
  end_at timestamptz default null
)
returns table (
  id uuid,
  title text,
  transcript text,
  summary text,
  tags jsonb,
  folder_id uuid,
  recorded_at timestamptz,
  is_starred boolean,
  rank real
)
language sql
security definer
set search_path = public
as $$
  select
    n.id,
    n.title,
    n.transcript,
    n.summary,
    n.tags,
    n.folder_id,
    n.recorded_at,
    n.is_starred,
    ts_rank_cd(n.search_vector, websearch_to_tsquery('english', search_term)) as rank
  from public.notes n
  where n.user_id = auth.uid()
    and (
      search_term is null
      or btrim(search_term) = ''
      or n.search_vector @@ websearch_to_tsquery('english', search_term)
    )
    and (
      filter_tag is null
      or exists (
        select 1
        from jsonb_array_elements_text(coalesce(n.tags, '[]'::jsonb)) as tag_value
        where lower(tag_value) = lower(filter_tag)
      )
    )
    and (filter_folder_id is null or n.folder_id = filter_folder_id)
    and (start_at is null or n.recorded_at >= start_at)
    and (end_at is null or n.recorded_at <= end_at)
  order by rank desc nulls last, n.recorded_at desc;
$$;

comment on function public.search_notes is 'Searches Memvo notes by full-text rank across title, transcript, summary, and tags with optional folder and date filters.';

create or replace function public.invoke_process_note_with_ai()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  function_url text := current_setting('app.settings.memvo_process_note_with_ai_url', true);
  service_role_key text := current_setting('app.settings.memvo_service_role_key', true);
begin
  if new.transcript is null or btrim(new.transcript) = '' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.transcript, '') = coalesce(new.transcript, '') and coalesce(old.sync_status, '') = coalesce(new.sync_status, '') then
    return new;
  end if;

  if coalesce(new.sync_status, '') <> 'complete' then
    return new;
  end if;

  if function_url is null or function_url = '' or service_role_key is null or service_role_key = '' then
    raise log 'Memvo AI processing skipped because app.settings.memvo_process_note_with_ai_url or app.settings.memvo_service_role_key is not configured.';
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'type', 'note.transcription.completed',
      'record', jsonb_build_object('id', new.id)
    )
  );

  return new;
end;
$$;

drop trigger if exists on_note_transcription_complete_ai on public.notes;
create trigger on_note_transcription_complete_ai
  after insert or update of transcript, sync_status on public.notes
  for each row execute procedure public.invoke_process_note_with_ai();

comment on function public.invoke_process_note_with_ai is 'Posts completed transcripts to the process-note-with-ai Edge Function. Configure app.settings.memvo_process_note_with_ai_url and app.settings.memvo_service_role_key first.';
