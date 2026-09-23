import { Download } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, PageHeader, ProgressBar, SessionStatusBadge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { useToast } from '../../components/toast';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { downloadCsv } from '../../lib/csv';
import { fmtDate, fmtTime, pct } from '../../lib/format';
import type { AttendanceSessionWithStats, CourseStudentRow, LecturerCourseRow } from '../../services/types';

export function LecturerReportsPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useAsync<{
    courseRows: LecturerCourseRow[];
    sessions: AttendanceSessionWithStats[];
  }>(async () => {
    if (!profile) throw new Error('Not signed in.');
    const lecturer = await backend.getLecturerByProfile(profile.id);
    if (!lecturer) throw new Error('No lecturer record is linked to your account.');
    const activeSession = await backend.getActiveAcademicSession();
    const [courseRows, sessions] = await Promise.all([
      backend.getLecturerCourseSummary(lecturer.id, activeSession?.id),
      backend.listAttendanceSessions({ lecturerId: lecturer.id }),
    ]);
    return { courseRows, sessions };
  }, [profile?.id]);

  const exportCourse = async (courseId: string, code: string) => {
    try {
      const rows: CourseStudentRow[] = await backend.getCourseAttendanceSummary(courseId);
      downloadCsv(
        `${code}-attendance-report.csv`,
        ['Student Name', 'Matric Number', 'Sessions Held', 'Present', 'Late', 'Absent', 'Attendance %'],
        rows.map((r) => [
          r.student.profile?.fullName ?? '',
          r.student.studentNumber,
          r.sessionsHeld,
          r.present,
          r.late,
          r.absent,
          r.percentage === null ? '' : r.percentage.toFixed(1),
        ])
      );
    } catch (err) {
      //surfaced via toast-less alert for simplicity here
      window.alert(errMessage(err));
    }
  };

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Generating your reports…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  const courseRows = data?.courseRows ?? [];
  const sessions = data?.sessions ?? [];

  const courseColumns: Column<LecturerCourseRow>[] = [
    {
      header: 'Course',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.course.code}</p>
          <p className="text-xs text-slate-500">{r.course.title}</p>
        </div>
      ),
    },
    { header: 'Sessions held', className: 'text-center', render: (r) => r.sessionsHeld },
    { header: 'Enrolled', className: 'text-center', render: (r) => r.enrolled },
    { header: 'Average attendance', render: (r) => (
      <div className="flex items-center gap-2">
        <ProgressBar value={r.averageAttendance} className="w-24" />
        <span className="text-sm font-semibold text-slate-800">{pct(r.averageAttendance)}</span>
      </div>
    ) },
    {
      header: '',
      className: 'text-right',
      render: (r) => (
        <Button variant="secondary" size="sm" onClick={() => exportCourse(r.course.id, r.course.code)}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      ),
    },
  ];

  const sessionColumns: Column<AttendanceSessionWithStats>[] = [
    { header: 'Course', render: (s) => <span className="font-semibold text-slate-900">{s.course?.code}</span> },
    { header: 'Date', render: (s) => fmtDate(s.sessionDate) },
    { header: 'Start', render: (s) => fmtTime(s.startTime) },
    { header: 'Present', className: 'text-center', render: (s) => s.stats.present + s.stats.late },
    { header: 'Enrolled', className: 'text-center', render: (s) => s.stats.enrolled },
    { header: 'Rate', render: (s) => <b className={((s.rate ?? 0) >= 70 ? 'text-emerald-600' : 'text-amber-600')}>{pct(s.rate)}</b> },
    { header: 'Status', render: (s) => <SessionStatusBadge status={s.status} /> },
  ];

  return (
    <>
      <PageHeader title="Reports" subtitle="Attendance summary for your courses and sessions (doc §31)." />

      <Card>
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-slate-900">Lecturer report — by course</h2>
        </div>
        <DataTable
          columns={courseColumns}
          rows={courseRows}
          keyOf={(r) => r.course.id}
          mobileCard={(r) => (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{r.course.code} — {r.course.title}</p>
                <p className={`text-sm font-bold ${(r.averageAttendance ?? 0) >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{pct(r.averageAttendance)}</p>
              </div>
              <p className="mt-1 text-xs text-slate-500">{r.sessionsHeld} sessions · {r.enrolled} enrolled</p>
              <ProgressBar value={r.averageAttendance} className="mt-2" />
              <Button variant="secondary" size="sm" className="mt-3" full onClick={() => exportCourse(r.course.id, r.course.code)}>
                <Download className="h-3.5 w-3.5" /> Export student report (CSV)
              </Button>
            </div>
          )}
          empty={<EmptyState title="No courses assigned" message="Reports appear once courses are assigned to you and sessions have been held." />}
        />
      </Card>

      <Card className="mt-4">
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-slate-900">Session history</h2>
        </div>
        <DataTable
          columns={sessionColumns}
          rows={sessions}
          keyOf={(s) => s.id}
          mobileCard={(s) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{s.course?.code} · {fmtDate(s.sessionDate)}</p>
                <p className="text-xs text-slate-500">{fmtTime(s.startTime)} — {s.stats.present + s.stats.late}/{s.stats.enrolled} present ({pct(s.rate)})</p>
              </div>
              <SessionStatusBadge status={s.status} />
            </div>
          )}
          empty={<EmptyState title="No sessions yet" message="Start an attendance session to build your session history." />}
        />
      </Card>
    </>
  );
}
