-- supabase/migrations/001_initial.sql
-- HR Platform — Фаза 1: Начална схема
-- Изпълни с: npx supabase db push

-- ============================================================
-- PROFILES
-- Разширява auth.users с допълнителни данни
-- ============================================================
create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  full_name  text not null,
  role       text not null default 'employee'
               check (role in ('employee', 'admin')),
  created_at timestamptz not null default now()
);

-- Trigger: автоматично създава profile при регистрация
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS за profiles
alter table public.profiles enable row level security;

create policy "Потребителите виждат собствения профил"
  on public.profiles for select
  using (id = auth.uid());

create policy "Администраторите виждат всички профили"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Потребителите редактират собствения профил"
  on public.profiles for update
  using (id = auth.uid());

-- ============================================================
-- REQUESTS
-- ============================================================
create table if not exists public.requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles(id) on delete cascade not null,
  type          text not null check (type in ('vacation', 'sick_leave')),
  date_from     date not null,
  date_to       date not null,
  notes         text,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected')),
  -- файлове в Supabase Storage
  document_path text,          -- болничен лист (само sick_leave)
  pdf_path      text,          -- генерираният одитен PDF
  -- 2FA одитни данни (от JWT в момента на подаване)
  auth_method   text,          -- 'totp'
  auth_at       timestamptz,   -- кога е верифициран 2FA факторът
  ip_address    text,
  user_agent    text,
  -- timestamps
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  -- constraint: date_to >= date_from
  constraint valid_date_range check (date_to >= date_from)
);

-- Trigger: обновява updated_at при промяна
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger requests_updated_at
  before update on public.requests
  for each row execute procedure public.set_updated_at();

-- RLS за requests
alter table public.requests enable row level security;

create policy "Служителите виждат само своите заявки"
  on public.requests for select
  using (user_id = auth.uid());

create policy "Служителите създават свои заявки"
  on public.requests for insert
  with check (user_id = auth.uid());

create policy "Администраторите виждат всички заявки"
  on public.requests for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Администраторите обновяват статус"
  on public.requests for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================================
-- AUDIT LOG — append-only, никога не се трие
-- ============================================================
create table if not exists public.audit_log (
  id         bigserial primary key,
  user_id    uuid,            -- може да е null ако потребителят е изтрит
  action     text not null,   -- вж. AuditAction в types/index.ts
  request_id uuid,
  metadata   jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- RLS: само INSERT е позволен за автентицирани потребители
-- UPDATE и DELETE са забранени за всички (enforcement on DB level)
alter table public.audit_log enable row level security;

create policy "Само вмъкване в audit_log"
  on public.audit_log for insert
  with check (true);

create policy "Администраторите четат audit_log"
  on public.audit_log for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Изрично забраняваме UPDATE и DELETE без policy (RLS ги блокира по default)
-- За допълнителна сигурност — revoke от authenticated role:
revoke update, delete on public.audit_log from authenticated;
revoke update, delete on public.audit_log from anon;

-- ============================================================
-- STORAGE BUCKETS
-- Изпълни в Supabase Dashboard → Storage → New bucket
-- ============================================================
-- Bucket: "documents" — private
-- Policy: authenticated потребители качват в requests/{own_user_id}/
-- Policy: authenticated потребители четат собствените си файлове
-- Policy: admin чете всички файлове
--
-- INSERT в storage.objects:
-- bucket_id = 'documents'
-- name LIKE 'requests/' || auth.uid() || '/%'
--
-- SELECT в storage.objects:
-- bucket_id = 'documents' AND (
--   name LIKE 'requests/' || auth.uid() || '/%'
--   OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
-- )

-- ============================================================
-- ИНДЕКСИ
-- ============================================================
create index if not exists idx_requests_user_id  on public.requests(user_id);
create index if not exists idx_requests_status   on public.requests(status);
create index if not exists idx_requests_created  on public.requests(created_at desc);
create index if not exists idx_audit_user_id     on public.audit_log(user_id);
create index if not exists idx_audit_request_id  on public.audit_log(request_id);
create index if not exists idx_audit_created     on public.audit_log(created_at desc);
