import { Link } from 'react-router-dom';
import { BarChart3, BookOpen, Building2, ClipboardList, GraduationCap, Percent, Radio, Users } from 'lucide-react';
import { Card, EmptyState, ErrorState, PageHeader, SessionStatusBadge, StatCard } from '../../components/ui';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { fmtDate, fmtTime, pct } from '../../lib/format';
import type { AdminStats } from '../../services/types';
import type { AttendanceSessionWithStats } from '../../services/types';

const QUICK_LINKS = [
  { to: '/admin/students', label: 'Students', icon: GraduationCap },
  { to: '/admin/lecturers', label: 'Lecturers', icon: Users },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/enrollments', label: 'Enrollments', icon: ClipboardList },
  { to: '/admin/sessions', label: 'Academic Sessions', icon: Building2 },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
];

export function AdminDashboard() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [stats, recent] = await Promise.all([
      backend.getAdminStats(),
      backend.listAttendanceSessions().then((rows) => rows.slice(0, 6)),
    ]);
    return { stats, recent };
  }, []);

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading dashboard…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;
  if (!data) return null;
  const { stats, recent } = data;

  return (
    <>
      <PageHeader title="Admin Dashboard" subtitle="Overview of the institution's attendance system." />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="Total Students" value={stats.students} icon={<GraduationCap className="h-5 w-5" />} />
        <StatCard label="Total Lecturers" value={stats.lecturers} icon={<Users className="h-5 w-5" />} tone="sky" />
        <StatCard label="Total Courses" value={stats.courses} icon={<BookOpen className="h-5 w-5" />} tone="amber" />
        <StatCard label="Departments" value={stats.departments} icon={<Building2 className="h-5 w-5" />} tone="emerald" />
        <StatCard label="Active Sessions" value={stats.activeSessions} icon={<Radio className="h-5 w-5" />} tone={stats.activeSessions > 0 ? 'emerald' : 'sky'} />
        <StatCard label="Today's Attendance" value={pct(stats.todayRate)} icon={<Percent className="h-5 w-5" />} tone="rose" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-slate-900">Recent attendance sessions</h2>
            <Link to="/admin/attendance" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View all
            </Link>
          </div>
          {recent.length === 0 ? (
            <EmptyState
              icon={<ClipboardList className="h-7 w-7" />}
              title="No attendance sessions yet"
              message="Sessions opened by lecturers will appear here."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {recent.map((s: AttendanceSessionWithStats) => (
                <li key={s.id}>
                  <Link to={`/admin/attendance/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-50 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {s.course?.code} — {fmtDate(s.sessionDate)} · {fmtTime(s.startTime)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.stats.present + s.stats.late}/{s.stats.enrolled} attended ({pct(s.rate)}) · {s.lecturer?.profile?.fullName}
                      </p>
                    </div>
                    <SessionStatusBadge status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-slate-900">Quick actions</h2>
          </div>
          <nav className="grid grid-cols-2 gap-2 p-4">
            {QUICK_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="flex flex-col items-center gap-2 rounded-xl bg-slate-50 px-3 py-4 text-center text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-indigo-50 hover:text-indigo-700 hover:ring-indigo-200"
              >
                <l.icon className="h-5 w-5" />
                {l.label}
              </Link>
            ))}
          </nav>
        </Card>
      </div>
    </>
  );
}
