# SmartAttend — Mobile-Based Attendance Monitoring System

A mobile-first attendance monitoring system for educational institutions.
Administrators manage the institution, lecturers run QR-based attendance
sessions, and students record attendance from their phones.

Built with **React + TypeScript + Tailwind CSS**, designed for **Supabase**
(PostgreSQL + Auth + Row Level Security + Edge Functions), deployable on
**Vercel**, installable as a **PWA**, and packageable as an Android app with
**Capacitor**.

---

## ✨ Features

| Role       | Capabilities                                                                                                            |
| ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Admin**  | Dashboard · Students · Lecturers · Departments · Courses · Enrollments · Course assignments · Academic sessions · Attendance records · Reports (CSV export) · Settings |
| **Lecturer** | Dashboard · My courses · Start attendance · Live QR code with countdown & refresh · Live scan monitor · Manual marking · Close/reopen sessions · Reports (CSV export) |
| **Student** | Dashboard with attendance % · Courses · QR scanner + manual code entry · One-tap attendance for open sessions · History · Profile & password |

Anti-proxy safeguards (doc §25): authenticated accounts, enrollment checks,
one-record-per-session database constraint, expiring rotating QR tokens,
optional lecturer review & manual confirmation.

---

## 🚀 Quick start (demo mode — zero setup)

```bash
npm install
npm run dev
```

The app boots in **demo mode**: a seeded backend (departments, lecturers,
students, courses, enrollment and attendance history) persists in your
browser's localStorage. Sign in with:

| Role     | Email                            | Password   |
| -------- | -------------------------------- | ---------- |
| Admin    | `admin@smartattend.test`         | `demo1234` |
| Lecturer | `lecturer@smartattend.test`      | `demo1234` |
| Student  | `student@smartattend.test`       | `demo1234` |

**Try the full flow:** sign in as the *Lecturer* → *Start attendance* → the QR
page shows a live code. Then sign in as the *Student* → the dashboard shows an
“Attendance is open” banner (or use *Scan → Demo shortcut*) → confirm. Back on
the lecturer's session page, the scan appears within seconds.

---

## 🔌 Switching to a real Supabase project

1. **Create a project** at [supabase.com](https://supabase.com).
2. **Run the migration** — open *SQL Editor* and run
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   It creates all tables, constraints, triggers, RLS policies and the
   `record_attendance()` RPC.
3. **Promote your first admin** — add a user in *Authentication → Users*, then:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@institution.edu';
   ```
4. **Deploy the Edge Function** (admin-only user creation):
   ```bash
   supabase functions deploy manage-user --project-ref <your-project-ref>
   ```
   It requires `SUPABASE_SERVICE_ROLE_KEY`, which Supabase injects automatically.
5. **Configure the frontend**:
   ```bash
   cp .env.example .env
   ```
   ```env
   VITE_BACKEND_MODE=supabase
   VITE_SUPABASE_URL=https://<ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon/public key — never the service_role key>
   ```
6. `npm run dev` — every screen now talks to your live database.

> **Security note:** the service-role key lives *only* in the Edge Function
> environment. The browser receives the anon key, and all authorization is
> enforced by RLS (doc §33–37).

---

## 🗄️ Database

```
profiles ─┬─ students ── course_enrollments ── courses ── attendance_sessions ── attendance_records
          └─ lecturers ─ lecturer_courses ──────────┘                (unique(session, student))
```

- Unique constraints: matric/staff numbers, course codes, enrollment triples,
  assignment triples, **one attendance record per student per session**.
- Only one active academic session (partial unique index).
- `record_attendance(token)` validates: authenticated → active student →
  token exists → session open → token not expired → enrolled → not already
  marked → inserts `present`/`late` (late = >10 min after start).

Full schema: [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

---

## 📁 Project structure

```
src/
├── components/        # UI kit, DataTable, DashboardLayout, toast, modals
├── layouts/           # AdminLayout, LecturerLayout, StudentLayout (sidebar + bottom nav)
├── pages/
│   ├── auth/          # Login, Forgot password
│   ├── attend/        # /attend/:token QR deep-link confirmation
│   ├── admin/         # 12 admin pages
│   ├── lecturer/      # 6 lecturer pages (incl. live QR session page)
│   └── student/       # 5 student pages (incl. scanner)
├── services/          # Backend contract + MockBackend + SupabaseBackend + aggregation
├── context/           # AuthContext (session, role-based redirects)
├── hooks/             # useAsync, useInterval
├── lib/               # supabase client, errors, formatting, CSV
└── types/             # Domain types
supabase/
├── migrations/        # 0001_init.sql (schema + RLS + RPC)
└── functions/         # manage-user Edge Function (Deno)
```

Both backends implement the same `Backend` interface (`src/services/types.ts`),
so switching modes changes zero UI code.

---

## 📱 Mobile, PWA & Android

- Mobile-first responsive layouts: bottom navigation on phones, sidebar on
  desktop; tested breakpoints from 320 px up.
- **PWA**: `manifest.webmanifest` + service worker — users can “Install app”
  from Chrome/Safari for a home-screen icon and offline app shell.
- **Android (optional)**: complete the web app first, then
  ```bash
  npm i @capacitor/core @capacitor/cli
  npx cap init SmartAttend com.example.smartattend --web-dir=dist
  npm run build && npx cap add android
  npx cap open android   # build APK/AAB from Android Studio
  ```

---

## 🧪 Suggested test pass (doc §55–60)

- Auth: correct/wrong login per role, logout, invalid input, reset email.
- Authorization: student cannot reach `/admin`, lecturer edits only assigned
  courses, direct API writes are rejected by RLS.
- Attendance: valid scan, expired token, refreshed token, duplicate scan,
  unenrolled student, closed session, manual marking.
- Reports: course & student reports, CSV export.

---

## 🛠️ Scripts

| Command           | Purpose                              |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Dev server (hot reload)              |
| `npm run build`   | Type-check + production build        |
| `npm run preview` | Preview the production build         |

---

## ☁️ Deploying to Vercel

1. Push to GitHub.
2. Import the repo in Vercel (framework: **Vite** — auto-detected).
3. Add `VITE_BACKEND_MODE`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` in
   *Project → Settings → Environment Variables*.
4. Deploy. In Supabase *Authentication → URL Configuration*, set the Site URL
   to your Vercel domain so password-reset links land correctly.
