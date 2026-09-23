import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CalendarClock, Percent, Play, QrCode } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, PageHeader, SessionStatusBadge, StatCard } from '../../components/ui';
import { StartSessionModal } from '../../components/StartSessionModal';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { fmtDate, fmtTime, pct } from '../../lib/format';
import type { Course, Lecturer } from '../../types';
import type { LecturerStats } from '../../services/types';

interface DashData {
  lecturer: Lecturer;
  stats: LecturerStats;
  courses: Course[];
  academicSessionId: string;
}

export function LecturerDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [startOpen, setStartOpen] = useState(false);

  const { data, loading, error, reload } = useAsync<DashData>(async () => {
    if (!profile) throw new Error('Not signed in.');
    const lecturer = await backend.getLecturerByProfile(profile.id);
    if (!lecturer) throw new Error('No lecturer record is linked to your account. Contact the administrator.');
    const activeSession = await backend.getActiveAcademicSession();
    const academicSessionId = activeSession?.id ?? '';
    const [stats, courses] = await Promise.all([
      backend.getLecturerStats(lecturer.id),
      backend.listAssignments({ lecturerId: lecturer.id, academicSessionId }).then((rows) =>
        rows.map((r) => r.course).filter((c): c is Course => Boolean(c))
      ),
    ]);
    return { lecturer, stats, courses, academicSessionId };
  }, [profile?.id]);

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading your dashboard…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;
  if (!data) return null;

  const { lecturer, stats, courses, academicSessionId } = data;

  return (
    <>
      <PageHeader
        title={`Welcome, ${lecturer.profile?.fullName ?? 'Lecturer'}`}
        subtitle={lecturer.department ? `${lecturer.department.name} · ${lecturer.staffNumber}` : lecturer.staffNumber}
        action={
          <Button onClick={() => setStartOpen(true)} disabled={courses.length === 0}>
            <Play className="h-4 w-4" /> Start attendance
          </Button>
        }
      />

      {stats.activeSession && (
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-3 border-l-4 border-emerald-500 p-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              Live now — {stats.activeSession.course?.code} · {stats.activeSession.stats.present + stats.activeSession.stats.late} of {stats.activeSession.stats.enrolled} scanned
            </p>
            <p className="mt-0.5 text-xs text-slate-500">Students see the QR code update the moment they scan.</p>
          </div>
          <Button size="sm" variant="success" onClick={() => navigate(`/lecturer/attendance/${stats.activeSession!.id}`)}>
            <QrCode className="h-4 w-4" /> Open session
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="My Courses" value={stats.courseCount} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard label="Today's Sessions" value={stats.sessionsToday} icon={<CalendarClock className="h-5 w-5" />} tone="sky" />
        <StatCard
          label="Average Attendance"
          value={pct(stats.averageAttendance)}
          icon={<Percent className="h-5 w-5" />}
          tone={stats.averageAttendance !== null && stats.averageAttendance >= 70 ? 'emerald' : 'amber'}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-slate-900">Recent attendance sessions</h2>
            <Link to="/lecturer/attendance" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View all
            </Link>
          </div>
          {stats.recentSessions.length === 0 ? (
            <EmptyState
              icon={<QrCode className="h-7 w-7" />}
              title="No attendance sessions yet"
              message="Start an attendance session to begin recording attendance for your courses."
              action={<Button onClick={() => setStartOpen(true)}><Play className="h-4 w-4" /> Start attendance</Button>}
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {stats.recentSessions.map((s) => (
                <li key={s.id}>
                  <Link to={`/lecturer/attendance/${s.id}`} className="flex items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-slate-50 sm:px-5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {s.course?.code} — {fmtDate(s.sessionDate)} · {fmtTime(s.startTime)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {s.stats.present + s.stats.late}/{s.stats.enrolled} present ({pct(s.rate)})
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
            <h2 className="text-base font-semibold text-slate-900">My courses</h2>
          </div>
          {courses.length === 0 ? (
            <EmptyState
              icon={<BookOpen className="h-7 w-7" />}
              title="No courses assigned"
              message="Ask the administrator to assign courses to you for the active session."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {courses.map((c) => (
                <li key={c.id}>
                  <Link to={`/lecturer/courses/${c.id}`} className="block px-4 py-3 transition hover:bg-slate-50 sm:px-5">
                    <p className="text-sm font-semibold text-indigo-600">{c.code}</p>
                    <p className="truncate text-sm text-slate-600">{c.title}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <StartSessionModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        courses={courses}
        lecturerId={lecturer.id}
        academicSessionId={academicSessionId}
      />
    </>
  );
}
