-- ─────────────────────────────────────────────────────────────
-- updated_at trigger function (shared utility)
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- judgments
-- ─────────────────────────────────────────────────────────────
create table public.judgments (
  id                 uuid primary key default uuid_generate_v4(),
  user_id            uuid references auth.users(id) on delete cascade not null,

  -- Core rule
  verb               text not null check (verb in ('always', 'never', 'prefer', 'avoid')),
  domain             text not null,
  statement          text not null,
  context_id         uuid references public.contexts(id) on delete set null default null,

  -- Lifecycle
  status             text not null default 'proposed'
                       check (status in ('proposed', 'confirmed', 'rejected', 'retired')),

  -- AI-assigned (set at extraction time)
  confidence         numeric(4,3) default null
                       check (confidence is null or (confidence >= 0 and confidence <= 1)),

  -- Human-assigned (set at confirm time, null while proposed)
  strength           integer default null
                       check (strength is null or (strength >= 1 and strength <= 5)),

  -- Provenance
  source_capture_ids uuid[] not null default '{}',
  proposed_by        text default null,
  proposed_at        timestamptz not null default now(),
  confirmed_by       text default null,
  confirmed_at       timestamptz default null,
  review_note        text default null,

  -- Supersession chain
  supersedes_id      uuid references public.judgments(id) on delete set null default null,
  superseded_at      timestamptz default null,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.judgments enable row level security;

create policy "Users see own judgments"
  on public.judgments for select
  using (auth.uid() = user_id);

create policy "Users insert own judgments"
  on public.judgments for insert
  with check (auth.uid() = user_id);

create policy "Users update own judgments"
  on public.judgments for update
  using (auth.uid() = user_id);

create policy "Users delete own judgments"
  on public.judgments for delete
  using (auth.uid() = user_id);

create trigger judgments_updated_at
  before update on public.judgments
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────
create index judgments_user_id_idx    on public.judgments(user_id);
create index judgments_context_id_idx on public.judgments(context_id);
create index judgments_status_idx     on public.judgments(user_id, status);
