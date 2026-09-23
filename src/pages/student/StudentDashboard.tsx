import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, Percent, Radio, ScanLine } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, PageHeader, ProgressBar, StatCard } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { pct } from '../../lib/format';
import type { AcademicSession, Student } from '../../types';
import type { StudentCourseRow, StudentStats } from '../../services/types';

interface DashData {
  student: Student;
  stats: StudentStats;
  summary: StudentCourseRow[];
  activeSession: AcademicSession | null;
}

export function StudentDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data, loading, error, reload } = useAsync<DashData>(async () => {
    if (!profile) throw new Error('Not signed in.');
    const student = await backend.getStudentByProfile(profile.id);
    if (!student) throw new Error('No student record is linked to your account. Contact the administrator.');
    const activeSession = await backend.getActiveAcademicSession();
    const [stats, summary] = await Promise.all([
      backend.getStudentStats(student.id),
      backend.getStudentCourseSummary(student.id, activeSession?.id),
    ]);
    return { student, stats, summary, activeSession };
  }, [profile?.id]);

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading your dashboard…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;
  if (!data) return null;

  const { student, stats, summary } = data;

  return (
    <>
      <PageHeader
        title={`Hello, ${student.profile?.fullName?.split(' ')[0] ?? 'Student'} 👋`}
        subtitle={
          student.department
            ? `${student.department.name} · ${student.level} level · ${student.studentNumber}`
            : student.studentNumber
        }
      />

      {/* Open attendance sessions — one tap to mark */}
      {stats.openSessions.length > 0 && (
        <div className="mb-5 space-y-2">
          {stats.openSessions.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center justify-between gap-3 border-l-4 border-emerald-500 p-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Attendance is open — {s.course?.code} {s.course?.title ? `(${s.course.title})` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    {s.lecturerName ?? 'Your lecturer'} is taking attendance now. Scan the classroom QR or mark below.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="success" onClick={() => navigate(`/attend/${encodeURIComponent(s.qrToken)}`)}>
                <ScanLine className="h-4 w-4" /> Mark attendance
              </Button>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label="My Courses" value={stats.courseCount} icon={<BookOpen className="h-5 w-5" />} />
        <StatCard
          label="Attendance"
          value={pct(stats.overallPercentage)}
          icon={<Percent className="h-5 w-5" />}
          tone={stats.overallPercentage !== null && stats.overallPercentage >= 70 ? 'emerald' : 'rose'}
          sub={stats.overallPercentage !== null && stats.overallPercentage < 70 ? 'Below 70% — attend more classes' : undefined}
        />
        <StatCard label="Open Now" value={stats.openSessions.length} icon={<Radio className="h-5 w-5" />} tone={stats.openSessions.length ? 'emerald' : 'sky'} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-slate-900">My courses</h2>
            <Link to="/student/courses" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
              View all
            </Link>
          </div>
          {summary.length === 0 ? (
            <EmptyState
              icon={<GraduationCap className="h-7 w-7" />}
              title="No registered courses yet"
              message="You have not been enrolled in any course for this academic session. Contact your course adviser or the administrator."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {summary.slice(0, 4).map((row) => (
                <li key={row.course.id} className="px-4 py-3.5 sm:px-5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{row.course.code}</p>
                      <p className="truncate text-sm text-slate-500">{row.course.title}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${row.percentage !== null && row.percentage < 70 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {pct(row.percentage)}
                      </p>
                      <p className="text-xs text-slate-400">{row.attended}/{row.sessionsHeld} sessions</p>
                    </div>
                  </div>
                  <ProgressBar value={row.percentage} className="mt-2.5" />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col items-center justify-center gap-4 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <ScanLine className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900">Scan attendance</h2>
            <p className="mt-1 text-sm text-slate-500">
              In class? Scan the QR code your lecturer displays — or enter the session code.
            </p>
          </div>
          <Button size="lg" full onClick={() => navigate('/student/scan')}>
            <ScanLine className="h-5 w-5" /> Open scanner
          </Button>
        </Card>
      </div>
    </>
  );
}
