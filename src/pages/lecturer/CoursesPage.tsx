import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, Users } from 'lucide-react';
import { Card, EmptyState, ErrorState, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { pct } from '../../lib/format';
import type { LecturerCourseRow } from '../../services/types';

export function LecturerCoursesPage() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsync<LecturerCourseRow[]>(async () => {
    if (!profile) throw new Error('Not signed in.');
    const lecturer = await backend.getLecturerByProfile(profile.id);
    if (!lecturer) throw new Error('No lecturer record is linked to your account.');
    const activeSession = await backend.getActiveAcademicSession();
    return backend.getLecturerCourseSummary(lecturer.id, activeSession?.id);
  }, [profile?.id]);

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading your courses…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader title="My Courses" subtitle="Courses assigned to you for the active academic session." />
      {(data ?? []).length === 0 ? (
        <Card>
          <EmptyState
            icon={<BookOpen className="h-7 w-7" />}
            title="No courses assigned"
            message="When the administrator assigns courses to you, they will appear here."
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data!.map((row) => (
            <Link key={row.course.id} to={`/lecturer/courses/${row.course.id}`} className="group">
              <Card className="h-full p-4 transition group-hover:ring-indigo-300 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-indigo-600">{row.course.code}</p>
                    <p className="mt-0.5 font-semibold text-slate-900">{row.course.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {row.course.level} level · {row.course.creditUnit} units
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:text-indigo-500" />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center ring-1 ring-inset ring-slate-200">
                  <div>
                    <p className="text-lg font-bold text-slate-900">{row.enrolled}</p>
                    <p className="flex items-center justify-center gap-1 text-[11px] text-slate-500">
                      <Users className="h-3 w-3" /> Enrolled
                    </p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">{row.sessionsHeld}</p>
                    <p className="text-[11px] text-slate-500">Sessions</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${(row.averageAttendance ?? 0) >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {pct(row.averageAttendance)}
                    </p>
                    <p className="text-[11px] text-slate-500">Avg attendance</p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
