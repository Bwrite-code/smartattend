-- ═══════════════════════════════════════════════════════════════════════════
-- SmartAttend — Mobile-Based Attendance Monitoring System
-- Initial schema: tables, constraints, triggers, RLS policies, RPC
--
-- Apply in the Supabase SQL Editor (or `supabase db push`) BEFORE switching
-- the frontend to VITE_BACKEND_MODE=supabase.
--
-- Security model (doc §33–37):
--   • Every table has Row Level Security enabled.
--   • Roles come from public.profiles.role — checked with SECURITY DEFINER
--     helper functions so RLS never trusts the JWT metadata alone.
--   • Students can NEVER insert attendance rows directly; the only path in is
--     record_attendance(), a SECURITY DEFINER function that validates the QR
--     token, enrollment and duplicates server-side.
--   • Creating/deleting auth users is done by the `manage-user` Edge Function
--     (service role), invoked only by verified admins.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. TABLES
-- ─────────────────────────────────────────────────────────────

-- profiles: one row per auth user (doc §12) ──────────────────
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null default '',
  email       text        not null,
  role        text        not null default 'student'
              check (role in ('admin', 'lecturer', 'student')),
  phone       text,
  avatar_url  text,
  is_active   boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.profiles is
  'Application user profiles. role is managed by admins/Edge Functions only — a signup trigger always defaults to student.';

-- departments (doc §13) ──────────────────────────────────────
create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null constraint uq_departments_name unique,
  code       text        not null constraint uq_departments_code unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- students (doc §14) ─────────────────────────────────────────
create table public.students (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid        not null unique references public.profiles (id) on delete cascade,
  student_number text        not null constraint uq_students_student_number unique,
  department_id  uuid        references public.departments (id) on delete set null,
  level          integer     not null default 100 check (level between 100 and 900),
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- lecturers (doc §15) ────────────────────────────────────────
create table public.lecturers (
  id             uuid primary key default gen_random_uuid(),
  profile_id     uuid        not null unique references public.profiles (id) on delete cascade,
  staff_number   text        not null constraint uq_lecturers_staff_number unique,
  department_id  uuid        references public.departments (id) on delete set null,
  is_active      boolean     not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- courses (doc §16) ──────────────────────────────────────────
create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  course_code  text        not null constraint uq_courses_course_code unique,
  course_title text        not null,
  department_id uuid       references public.departments (id) on delete set null,
  level        integer     not null default 100 check (level between 100 and 900),
  credit_unit  integer     not null default 3 check (credit_unit between 1 and 12),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- academic sessions (doc §19) ────────────────────────────────
create table public.academic_sessions (
  id         uuid primary key default gen_random_uuid(),
  name       text        not null constraint uq_academic_sessions_name unique,
  start_date date        not null,
  end_date   date        not null,
  is_active  boolean     not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date > start_date)
);
-- only ONE active session at a time:
create unique index uq_one_active_session on public.academic_sessions (is_active) where is_active;

-- course enrollments (doc §17) ───────────────────────────────
create table public.course_enrollments (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid        not null references public.courses (id) on delete cascade,
  student_id          uuid        not null references public.students (id) on delete cascade,
  academic_session_id uuid        not null references public.academic_sessions (id) on delete cascade,
  created_at          timestamptz not null default now(),
  constraint uq_enrollment unique (course_id, student_id, academic_session_id)
);

-- lecturer ↔ course assignments (doc §18) ────────────────────
create table public.lecturer_courses (
  id                  uuid primary key default gen_random_uuid(),
  lecturer_id         uuid        not null references public.lecturers (id) on delete cascade,
  course_id           uuid        not null references public.courses (id) on delete cascade,
  academic_session_id uuid        not null references public.academic_sessions (id) on delete cascade,
  created_at          timestamptz not null default now(),
  constraint uq_lecturer_course unique (lecturer_id, course_id, academic_session_id)
);

-- attendance sessions (doc §20) ──────────────────────────────
create table public.attendance_sessions (
  id                  uuid primary key default gen_random_uuid(),
  course_id           uuid        not null references public.courses (id) on delete cascade,
  lecturer_id         uuid        not null references public.lecturers (id) on delete cascade,
  academic_session_id uuid        not null references public.academic_sessions (id) on delete cascade,
  session_date        date        not null default current_date,
  start_time          time        not null default current_time,
  end_time            time,
  status              text        not null default 'active'
                      check (status in ('active', 'closed', 'cancelled')),
  qr_token            text        not null constraint uq_attendance_sessions_qr_token unique,
  qr_expires_at       timestamptz not null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index idx_attendance_sessions_lecturer on public.attendance_sessions (lecturer_id);
create index idx_attendance_sessions_course   on public.attendance_sessions (course_id);

-- attendance records (doc §21) ───────────────────────────────
create table public.attendance_records (
  id                   uuid primary key default gen_random_uuid(),
  attendance_session_id uuid       not null references public.attendance_sessions (id) on delete cascade,
  student_id           uuid        not null references public.students (id) on delete cascade,
  marked_at            timestamptz not null default now(),
  status               text        not null default 'present'
                       check (status in ('present', 'late', 'absent')),
  method               text        not null default 'qr'
                       check (method in ('qr', 'manual')),
  created_at           timestamptz not null default now(),
  -- one attendance per student per session (doc §21):
  constraint uq_attendance_record unique (attendance_session_id, student_id)
);
create index idx_attendance_records_student on public.attendance_records (student_id);

-- ─────────────────────────────────────────────────────────────
-- 2. TRIGGERS
-- ─────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['profiles','departments','students','lecturers','courses',
                           'academic_sessions','attendance_sessions']
  loop
    execute format('create trigger trg_%s_updated_at before update on public.%I
                    for each row execute function public.set_updated_at();', t, t);
  end loop;
end;
$$;

-- New auth users always start as plain students (doc §36 — never trust
-- client-supplied roles). The manage-user Edge Function promotes the role
-- with the service-role key when an ADMIN creates a lecturer/admin account.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    'student'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 3. ROLE HELPER FUNCTIONS (SECURITY DEFINER — used by RLS)
-- ─────────────────────────────────────────────────────────────

create or replace function public.current_role()
returns text
language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid()) = 'admin', false);
$$;

create or replace function public.current_student_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.students where profile_id = auth.uid();
$$;

create or replace function public.current_lecturer_id()
returns uuid
language sql stable security definer
set search_path = public
as $$
  select id from public.lecturers where profile_id = auth.uid();
$$;

create or replace function public.is_course_lecturer(p_course_id uuid, p_academic_session_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lecturer_courses
    where course_id = p_course_id
      and academic_session_id = p_academic_session_id
      and lecturer_id = public.current_lecturer_id()
  );
$$;

create or replace function public.activate_academic_session(p_session_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only administrators can activate sessions' using errcode = '42501';
  end if;
  update public.academic_sessions set is_active = false where is_active;
  update public.academic_sessions set is_active = true where id = p_session_id;
end;
$$;

-- ─────────────────────────────────────────────────────────────
-- 4. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────

alter table public.profiles            enable row level security;
alter table public.departments         enable row level security;
alter table public.students            enable row level security;
alter table public.lecturers           enable row level security;
alter table public.courses             enable row level security;
alter table public.academic_sessions   enable row level security;
alter table public.course_enrollments  enable row level security;
alter table public.lecturer_courses    enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records  enable row level security;

-- profiles ───────────────────────────────────────────────────
create policy "profiles: authenticated users can read names/roles"
  on public.profiles for select
  to authenticated
  using (true);
-- (rosters need student names; tighten with per-course EXISTS for production
--  if your institution requires stricter privacy)

create policy "profiles: users update own (cannot change role)"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role());

create policy "profiles: admins manage all"
  on public.profiles for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- reference tables: everyone authenticated reads, admin writes ──────────────
create policy "departments: read" on public.departments for select to authenticated using (true);
create policy "departments: admin write" on public.departments for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "courses: read" on public.courses for select to authenticated using (true);
create policy "courses: admin write" on public.courses for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "sessions: read" on public.academic_sessions for select to authenticated using (true);
create policy "sessions: admin write" on public.academic_sessions for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- students / lecturers: rosters are readable institution-wide; admin manages ─
create policy "students: read" on public.students for select to authenticated using (true);
create policy "students: admin manage" on public.students for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "lecturers: read" on public.lecturers for select to authenticated using (true);
create policy "lecturers: admin manage" on public.lecturers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- enrollments ────────────────────────────────────────────────
create policy "enrollments: read (admin / own / course lecturer)"
  on public.course_enrollments for select
  to authenticated
  using (
    public.is_admin()
    or student_id = public.current_student_id()
    or public.is_course_lecturer(course_id, academic_session_id)
  );

create policy "enrollments: admin manage"
  on public.course_enrollments for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- lecturer_courses ───────────────────────────────────────────
create policy "assignments: read (admin / owning lecturer)"
  on public.lecturer_courses for select
  to authenticated
  using (public.is_admin() or lecturer_id = public.current_lecturer_id());

create policy "assignments: admin manage"
  on public.lecturer_courses for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- attendance_sessions ────────────────────────────────────────
create policy "sessions: read (admin / owner / enrolled student)"
  on public.attendance_sessions for select
  to authenticated
  using (
    public.is_admin()
    or lecturer_id = public.current_lecturer_id()
    or (
      public.current_student_id() is not null
      and exists (
        select 1 from public.course_enrollments ce
        where ce.course_id = attendance_sessions.course_id
          and ce.academic_session_id = attendance_sessions.academic_session_id
          and ce.student_id = public.current_student_id()
      )
    )
  );

create policy "sessions: lecturers manage own (admin too)"
  on public.attendance_sessions for update
  to authenticated
  using (public.is_admin() or lecturer_id = public.current_lecturer_id())
  with check (public.is_admin() or lecturer_id = public.current_lecturer_id());

create policy "sessions: lecturers create own (admin too)"
  on public.attendance_sessions for insert
  to authenticated
  with check (public.is_admin() or lecturer_id = public.current_lecturer_id());

create policy "sessions: admin delete"
  on public.attendance_sessions for delete
  to authenticated
  using (public.is_admin());

-- attendance_records ─────────────────────────────────────────
create policy "records: read (admin / session lecturer / own)"
  on public.attendance_records for select
  to authenticated
  using (
    public.is_admin()
    or student_id = public.current_student_id()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.attendance_session_id
        and s.lecturer_id = public.current_lecturer_id()
    )
  );

create policy "records: lecturers/admin manage (manual marking)"
  on public.attendance_records for insert
  to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.attendance_session_id
        and s.lecturer_id = public.current_lecturer_id()
    )
  );

create policy "records: lecturers/admin update"
  on public.attendance_records for update
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.attendance_session_id
        and s.lecturer_id = public.current_lecturer_id()
    )
  )
  with check (
    public.is_admin()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.attendance_session_id
        and s.lecturer_id = public.current_lecturer_id()
    )
  );

create policy "records: lecturers/admin delete"
  on public.attendance_records for delete
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.attendance_sessions s
      where s.id = attendance_records.attendance_session_id
        and s.lecturer_id = public.current_lecturer_id()
    )
  );

-- NOTE: students have NO insert/update/delete policies here. The only way a
-- student records attendance is through record_attendance() below.

-- ─────────────────────────────────────────────────────────────
-- 5. ATTENDANCE RPC — the student scan pipeline (doc §29)
-- ─────────────────────────────────────────────────────────────

create or replace function public.record_attendance(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student  public.students;
  v_session  public.attendance_sessions;
  v_course   public.courses;
  v_status   text;
begin
  -- 1. authenticated?
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'unauthenticated',
      'message', 'Your session has ended. Please sign in again.');
  end if;

  -- 2. caller must be an active student
  select * into v_student from public.students where profile_id = auth.uid();
  if not found then
    return json_build_object('ok', false, 'code', 'not_student',
      'message', 'Only students can mark attendance.');
  end if;
  if not v_student.is_active then
    return json_build_object('ok', false, 'code', 'account_inactive',
      'message', 'Your student account is inactive. Contact the administrator.');
  end if;

  -- 3. token must exist
  select * into v_session from public.attendance_sessions
  where qr_token = trim(p_token);
  if not found then
    return json_build_object('ok', false, 'code', 'token_invalid',
      'message', 'Invalid attendance code. Scan the QR code shown by your lecturer.');
  end if;

  -- 4. session must be open
  if v_session.status <> 'active' then
    return json_build_object('ok', false, 'code', 'session_closed',
      'message', 'This attendance session is no longer open.');
  end if;

  -- 5. token must not be expired
  if now() > v_session.qr_expires_at then
    return json_build_object('ok', false, 'code', 'token_expired',
      'message', 'This QR code has expired. Ask your lecturer to refresh it.');
  end if;

  -- 6. must be enrolled
  if not exists (
    select 1 from public.course_enrollments
    where student_id = v_student.id
      and course_id = v_session.course_id
      and academic_session_id = v_session.academic_session_id
  ) then
    select * into v_course from public.courses where id = v_session.course_id;
    return json_build_object('ok', false, 'code', 'not_enrolled',
      'message', 'You are not registered for ' || coalesce(v_course.course_code, 'this course') || ' this session.');
  end if;

  -- 7. no duplicates (database constraint also enforces this)
  if exists (
    select 1 from public.attendance_records
    where attendance_session_id = v_session.id and student_id = v_student.id
  ) then
    return json_build_object('ok', false, 'code', 'already_marked',
      'message', 'You have already marked attendance for this session.');
  end if;

  -- 8. late if more than 10 minutes after the session start
  v_status := case
    when now() > (v_session.session_date + v_session.start_time + interval '10 minutes')
    then 'late' else 'present'
  end;

  insert into public.attendance_records (attendance_session_id, student_id, status, method)
  values (v_session.id, v_student.id, v_status, 'qr');

  select * into v_course from public.courses where id = v_session.course_id;

  return json_build_object(
    'ok', true,
    'status', v_status,
    'session_id', v_session.id,
    'course_code', v_course.course_code,
    'course_title', v_course.course_title,
    'session_date', v_session.session_date,
    'marked_at', to_json(now())
  );
end;
$$;

revoke all on function public.record_attendance(text) from public, anon;
grant execute on function public.record_attendance(text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. OPTIONAL: default roles for the first admin
--    After registering yourself via the app's sign-up or Supabase Auth
--    dashboard, promote yourself with:
--
--    update public.profiles set role = 'admin' where email = 'you@institution.edu';
-- ─────────────────────────────────────────────────────────────
