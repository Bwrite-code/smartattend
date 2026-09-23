import { BookOpen } from 'lucide-react';
import { Card, EmptyState, ErrorState, PageHeader, ProgressBar } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { pct } from '../../lib/format';
import type { Student } from '../../types';
import type { StudentCourseRow } from '../../services/types';

export function StudentCoursesPage() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsync<{ student: Student; rows: StudentCourseRow[] }>(async () => {
    if (!profile) throw new Error('Not signed in.');
    const student = await backend.getStudentByProfile(profile.id);
    if (!student) throw new Error('No student record is linked to your account.');
    const activeSession = await backend.getActiveAcademicSession();
    const rows = await backend.getStudentCourseSummary(student.id, activeSession?.id);
    return { student, rows };
  }, [profile?.id]);

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading your courses…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;
  if (!data) return null;

  return (
    <>
      <PageHeader title="My Courses" subtitle="Registered courses and attendance progress for the active academic session." />
      {data.rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="h-7 w-7" />}
            title="No registered courses yet"
            message="When the administrator enrolls you in courses, they will appear here with your attendance progress."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.rows.map((row) => (
            <Card key={row.course.id} className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-indigo-600">{row.course.code}</p>
                  <p className="mt-0.5 font-semibold text-slate-900">{row.course.title}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {row.course.department?.name} · {row.course.level} level · {row.course.creditUnit} units
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-lg font-bold ${row.percentage !== null && row.percentage < 70 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {pct(row.percentage)}
                  </p>
                  <p className="text-xs text-slate-400">attendance</p>
                </div>
              </div>
              <ProgressBar value={row.percentage} className="mt-4" />
              <p className="mt-2 text-xs text-slate-500">
                Attended <b>{row.attended}</b> of <b>{row.sessionsHeld}</b> sessions held
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
