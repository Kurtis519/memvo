begin;

create extension if not exists pgcrypto;
create extension if not exists pg_net with schema extensions;

do $$
begin
  create type public.memvo_plan as enum ('free', 'pro', 'admin');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.memvo_sync_status as enum ('pending', 'uploading', 'processing', 'complete', 'failed');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.memvo_referral_status as enum ('pending', 'qualified', 'rewarded');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.memvo_ai_processing_status as enum ('idle', 'processing', 'complete', 'failed', 'skipped');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  avatar_url text,
  plan public.memvo_plan not null default 'free',
  is_admin boolean not null default false,
  manual_pro boolean not null default false,
  referral_code text unique,
  referred_by_code text,
  bonus_minutes integer not null default 0,
  referral_bonus_minutes integer not null default 0,
  minutes_used_this_month numeric not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  referral_code text unique,
  bonus_minutes integer not null default 0,
  is_admin boolean not null default false,
  manual_pro boolean not null default false,
  minutes_used_this_month numeric not null default 0,
  full_name text,
  avatar_url text,
  plan public.memvo_plan not null default 'free',
  referred_by_code text
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
  unique (user_id, slug)
);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  title text not null default 'Untitled note',
  duration_seconds integer,
  transcript text,
  summary text,
  action_items jsonb not null default '[]'::jsonb,
  tags jsonb not null default '[]'::jsonb,
  folder_id uuid references public.folders(id) on delete set null,
  is_starred boolean not null default false,
  language_detected text,
  language_code text,
  transcription_engine text,
  mood text,
  audio_path text,
  sync_status public.memvo_sync_status not null default 'pending',
  ai_processing_status public.memvo_ai_processing_status not null default 'idle',
  ai_error text,
  ai_processed_at timestamptz,
  recorded_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  search_vector tsvector
);

create table if not exists public.sync_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  note_id uuid references public.notes(id) on delete set null,
  local_audio_path text not null,
  local_uri text,
  status public.memvo_sync_status not null default 'pending',
  retry_count integer not null default 0,
  error_message text,
  transcription_plan text,
  last_attempt_at timestamptz,
  next_retry_at timestamptz,
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

create table if not exists public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.user_profiles(id) on delete restrict,
  action_type text not null,
  target_user_id uuid not null references public.user_profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.deletions_log (
  id uuid primary key default gen_random_uuid(),
  user_id_hash text not null,
  deleted_at timestamptz not null default timezone('utc', now())
);

create index if not exists user_profiles_referral_code_idx on public.user_profiles (referral_code);
create index if not exists users_referral_code_idx on public.users (referral_code);
create unique index if not exists referrals_referred_user_id_unique on public.referrals (referred_user_id) where referred_user_id is not null;
create index if not exists folders_user_id_created_at_idx on public.folders (user_id, created_at desc);
create index if not exists notes_user_id_created_at_idx on public.notes (user_id, created_at desc);
create index if not exists notes_folder_id_idx on public.notes (folder_id);
create index if not exists notes_recorded_at_idx on public.notes (recorded_at desc);
create index if not exists sync_queue_user_id_created_at_idx on public.sync_queue (user_id, created_at desc);
create index if not exists referrals_referrer_user_id_created_at_idx on public.referrals (referrer_user_id, created_at desc);
create index if not exists admin_actions_admin_user_id_created_at_idx on public.admin_actions (admin_user_id, created_at desc);
create index if not exists deletions_log_deleted_at_idx on public.deletions_log (deleted_at desc);

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

create or replace function public.sync_users_from_user_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.users where id = old.id;
    return old;
  end if;

  insert into public.users (
    id,
    email,
    created_at,
    updated_at,
    referral_code,
    bonus_minutes,
    is_admin,
    manual_pro,
    minutes_used_this_month,
    full_name,
    avatar_url,
    plan,
    referred_by_code
  )
  values (
    new.id,
    new.email,
    new.created_at,
    new.updated_at,
    new.referral_code,
    new.bonus_minutes,
    new.is_admin,
    new.manual_pro,
    new.minutes_used_this_month,
    new.full_name,
    new.avatar_url,
    new.plan,
    new.referred_by_code
  )
  on conflict (id) do update
  set email = excluded.email,
      updated_at = excluded.updated_at,
      referral_code = excluded.referral_code,
      bonus_minutes = excluded.bonus_minutes,
      is_admin = excluded.is_admin,
      manual_pro = excluded.manual_pro,
      minutes_used_this_month = excluded.minutes_used_this_month,
      full_name = excluded.full_name,
      avatar_url = excluded.avatar_url,
      plan = excluded.plan,
      referred_by_code = excluded.referred_by_code;

  return new;
end;
$$;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  configured_admin_email text := lower(coalesce(current_setting('app.settings.admin_email', true), current_setting('app.settings.memvo_admin_email', true), ''));
begin
  insert into public.user_profiles (
    id,
    email,
    full_name,
    avatar_url,
    referral_code,
    is_admin,
    manual_pro,
    plan
  )
  values (
    new.id,
    lower(new.email),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url',
    public.generate_unique_referral_code(),
    case when lower(coalesce(new.email, '')) = configured_admin_email then true else false end,
    false,
    case when lower(coalesce(new.email, '')) = configured_admin_email then 'admin'::public.memvo_plan else 'free'::public.memvo_plan end
  )
  on conflict (id) do update
  set email = excluded.email,
      full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.user_profiles.avatar_url);

  return new;
end;
$$;

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

  select id into referrer_id
  from public.user_profiles
  where referral_code = normalized_referrer_code
  limit 1;

  if referrer_id is null then
    return jsonb_build_object('success', false, 'error', 'Referral code not found.');
  end if;

  select id into new_user_id
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
    select 1 from public.referrals where referred_user_id = new_user_id
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

  if tg_op = 'UPDATE'
     and coalesce(old.transcript, '') = coalesce(new.transcript, '')
     and coalesce(old.sync_status::text, '') = coalesce(new.sync_status::text, '') then
    return new;
  end if;

  if coalesce(new.sync_status::text, '') <> 'complete' then
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

drop trigger if exists set_user_profiles_updated_at on public.user_profiles;
create trigger set_user_profiles_updated_at
  before update on public.user_profiles
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_users_updated_at on public.users;
create trigger set_users_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_folders_updated_at on public.folders;
create trigger set_folders_updated_at
  before update on public.folders
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
  before update on public.notes
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_sync_queue_updated_at on public.sync_queue;
create trigger set_sync_queue_updated_at
  before update on public.sync_queue
  for each row execute procedure public.set_updated_at();

drop trigger if exists set_referrals_updated_at on public.referrals;
create trigger set_referrals_updated_at
  before update on public.referrals
  for each row execute procedure public.set_updated_at();

drop trigger if exists on_user_profiles_sync_public_users on public.user_profiles;
create trigger on_user_profiles_sync_public_users
  after insert or update on public.user_profiles
  for each row execute procedure public.sync_users_from_user_profiles();

drop trigger if exists on_user_profiles_delete_sync_public_users on public.user_profiles;
create trigger on_user_profiles_delete_sync_public_users
  after delete on public.user_profiles
  for each row execute procedure public.sync_users_from_user_profiles();

drop trigger if exists on_auth_user_created_memvo on auth.users;
create trigger on_auth_user_created_memvo
  after insert on auth.users
  for each row execute procedure public.handle_new_user_profile();

drop trigger if exists on_user_profile_created_seed_folders on public.user_profiles;
create trigger on_user_profile_created_seed_folders
  after insert on public.user_profiles
  for each row execute procedure public.seed_default_folders();

drop trigger if exists notes_search_vector_before_write on public.notes;
create trigger notes_search_vector_before_write
  before insert or update of title, transcript, summary, tags on public.notes
  for each row execute procedure public.notes_search_vector_update();

drop trigger if exists on_note_transcription_complete_ai on public.notes;
create trigger on_note_transcription_complete_ai
  after insert or update of transcript, sync_status on public.notes
  for each row execute procedure public.invoke_process_note_with_ai();

insert into public.user_profiles (
  id,
  email,
  full_name,
  avatar_url,
  referral_code,
  is_admin,
  manual_pro,
  plan,
  created_at,
  updated_at
)
select
  au.id,
  lower(au.email),
  coalesce(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name'),
  au.raw_user_meta_data ->> 'avatar_url',
  public.generate_unique_referral_code(),
  case when lower(coalesce(au.email, '')) = lower(coalesce(current_setting('app.settings.admin_email', true), current_setting('app.settings.memvo_admin_email', true), '')) then true else false end,
  false,
  case when lower(coalesce(au.email, '')) = lower(coalesce(current_setting('app.settings.admin_email', true), current_setting('app.settings.memvo_admin_email', true), '')) then 'admin'::public.memvo_plan else 'free'::public.memvo_plan end,
  timezone('utc', now()),
  timezone('utc', now())
from auth.users au
on conflict (id) do update
set email = excluded.email,
    full_name = coalesce(excluded.full_name, public.user_profiles.full_name),
    avatar_url = coalesce(excluded.avatar_url, public.user_profiles.avatar_url);

update public.user_profiles
set referral_code = public.generate_unique_referral_code()
where referral_code is null
   or referral_code !~ '^MEMVO-[A-Z0-9]{6}$';

insert into public.folders (user_id, name, slug, kind, position)
select p.id, seed.name, seed.slug, 'system', seed.position
from public.user_profiles p
cross join (
  values
    ('All Notes', 'all-notes', 0),
    ('Starred', 'starred', 1),
    ('Meetings', 'meetings', 2),
    ('Ideas', 'ideas', 3),
    ('Journals', 'journals', 4)
) as seed(name, slug, position)
where not exists (
  select 1
  from public.folders f
  where f.user_id = p.id
    and f.slug = seed.slug
);

update public.notes
set search_vector =
  setweight(to_tsvector('english', coalesce(title, '')), 'A')
  || setweight(to_tsvector('english', coalesce(transcript, '')), 'B')
  || setweight(to_tsvector('english', coalesce(summary, '')), 'B')
  || setweight(to_tsvector('english', coalesce((select string_agg(value::text, ' ') from jsonb_array_elements_text(coalesce(tags, '[]'::jsonb)) as value), '')), 'C')
where search_vector is null;

create index if not exists notes_search_vector_idx on public.notes using gin (search_vector);

alter table public.user_profiles enable row level security;
alter table public.users enable row level security;
alter table public.folders enable row level security;
alter table public.notes enable row level security;
alter table public.sync_queue enable row level security;
alter table public.referrals enable row level security;
alter table public.admin_actions enable row level security;
alter table public.deletions_log enable row level security;

drop policy if exists profiles_select_own on public.user_profiles;
create policy profiles_select_own on public.user_profiles
for select using (
  auth.uid() = id
  or exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
);

drop policy if exists profiles_insert_own on public.user_profiles;
create policy profiles_insert_own on public.user_profiles
for insert with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.user_profiles;
create policy profiles_update_own on public.user_profiles
for update using (auth.uid() = id)
with check (
  auth.uid() = id
  and is_admin = coalesce((select existing_profile.is_admin from public.user_profiles existing_profile where existing_profile.id = auth.uid()), false)
  and manual_pro = coalesce((select existing_profile.manual_pro from public.user_profiles existing_profile where existing_profile.id = auth.uid()), false)
);

drop policy if exists users_select_own_or_admin on public.users;
create policy users_select_own_or_admin on public.users
for select using (
  auth.uid() = id
  or exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
);

drop policy if exists folders_manage_own on public.folders;
create policy folders_manage_own on public.folders
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists notes_manage_own on public.notes;
create policy notes_manage_own on public.notes
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists sync_queue_manage_own on public.sync_queue;
create policy sync_queue_manage_own on public.sync_queue
for all using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists referrals_select_own_or_admin on public.referrals;
create policy referrals_select_own_or_admin on public.referrals
for select using (
  auth.uid() = referrer_user_id
  or auth.uid() = referred_user_id
  or exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
);

drop policy if exists referrals_insert_own on public.referrals;
create policy referrals_insert_own on public.referrals
for insert with check (auth.uid() = referrer_user_id);

drop policy if exists referrals_admin_update on public.referrals;
create policy referrals_admin_update on public.referrals
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

drop policy if exists admin_actions_select_admin on public.admin_actions;
create policy admin_actions_select_admin on public.admin_actions
for select using (
  exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
);

drop policy if exists admin_actions_insert_admin on public.admin_actions;
create policy admin_actions_insert_admin on public.admin_actions
for insert with check (
  exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
);

drop policy if exists deletions_log_admin_only on public.deletions_log;
create policy deletions_log_admin_only on public.deletions_log
for select using (
  exists (
    select 1 from public.user_profiles admin_profile
    where admin_profile.id = auth.uid() and admin_profile.is_admin = true
  )
);

comment on table public.users is 'Compatibility profile table requested for Table Editor visibility; synchronized from public.user_profiles.';
comment on table public.user_profiles is 'Canonical Memvo app profile table synchronized to the compatibility users table.';
comment on table public.sync_queue is 'Tracks offline recordings that still need upload, transcription, or retry handling.';
comment on table public.deletions_log is 'Stores hashed-only audit records for deleted Memvo accounts without retaining raw user identifiers.';
comment on function public.handle_new_user_profile is 'Reads the Supabase ADMIN_EMAIL secret through app.settings.admin_email to auto-assign the Memvo owner account admin access.';
comment on function public.award_referral_bonus is 'Awards Memvo referral bonus minutes exactly once for an eligible new user.';
comment on function public.search_notes is 'Searches Memvo notes by full-text rank across title, transcript, summary, and tags with optional folder and date filters.';
comment on function public.invoke_process_note_with_ai is 'Posts completed transcripts to the process-note-with-ai Edge Function when service settings are configured.';

commit;
