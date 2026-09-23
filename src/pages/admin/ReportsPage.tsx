import { useState } from 'react';
import { BarChart3, Download } from 'lucide-react';
import { Button, Card, EmptyState, ErrorState, PageHeader, ProgressBar, Select } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { useToast } from '../../components/toast';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { downloadCsv } from '../../lib/csv';
import { pct } from '../../lib/format';
import type { Course, Student } from '../../types';
import type { CourseStudentRow, StudentCourseRow } from '../../services/types';

type Tab = 'course' | 'student';

export function AdminReportsPage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('course');
  const [courseId, setCourseId] = useState('');
  const [studentId, setStudentId] = useState('');

  const { data, loading, error, reload } = useAsync<{ courses: Course[]; students: Student[] }>(async () => {
    const [courses, students] = await Promise.all([backend.listCourses(), backend.listStudents()]);
    return { courses, students };
  }, []);

  const { data: courseRows, loading: loadingCourse } = useAsync<CourseStudentRow[] | null>(async () => {
    if (tab !== 'course' || !courseId) return null;
    return backend.getCourseAttendanceSummary(courseId);
  }, [tab, courseId]);

  const { data: studentRows, loading: loadingStudent } = useAsync<StudentCourseRow[] | null>(async () => {
    if (tab !== 'student' || !studentId) return null;
    return backend.getStudentCourseSummary(studentId);
  }, [tab, studentId]);

  const exportCourse = () => {
    const course = data?.courses.find((c) => c.id === courseId);
    if (!courseRows || !course) return;
    downloadCsv(
      `${course.code}-attendance-report.csv`,
      ['Student Name', 'Matric Number', 'Sessions Held', 'Present', 'Late', 'Absent', 'Attendance %'],
      courseRows.map((r) => [
        r.student.profile?.fullName ?? '',
        r.student.studentNumber,
        r.sessionsHeld,
        r.present,
        r.late,
        r.absent,
        r.percentage === null ? '' : r.percentage.toFixed(1),
      ])
    );
  };

  const exportStudent = () => {
    const student = data?.students.find((s) => s.id === studentId);
    if (!studentRows || !student) return;
    downloadCsv(
      `${student.studentNumber.replace(/\//g, '-')}-attendance.csv`,
      ['Course Code', 'Course Title', 'Sessions Held', 'Attended', 'Attendance %'],
      studentRows.map((r) => [r.course.code, r.course.title, r.sessionsHeld, r.attended, r.percentage === null ? '' : r.percentage.toFixed(1)])
    );
  };

  const courseColumns: Column<CourseStudentRow>[] = [
    {
      header: 'Student',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.student.profile?.fullName}</p>
          <p className="font-mono text-xs text-slate-500">{r.student.studentNumber}</p>
        </div>
      ),
    },
    { header: 'Held', className: 'text-center', render: (r) => r.sessionsHeld },
    { header: 'Present', className: 'text-center', render: (r) => r.present },
    { header: 'Late', className: 'text-center', render: (r) => r.late },
    { header: 'Absent', className: 'text-center', render: (r) => r.absent },
    {
      header: 'Attendance %',
      render: (r) => (
        <div className="flex items-center gap-2">
          <ProgressBar value={r.percentage} className="w-24" />
          <b className={(r.percentage ?? 100) >= 70 ? 'text-emerald-600' : 'text-rose-600'}>{pct(r.percentage)}</b>
        </div>
      ),
    },
  ];

  const studentColumns: Column<StudentCourseRow>[] = [
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
    { header: 'Attended', className: 'text-center', render: (r) => r.attended },
    {
      header: 'Attendance %',
      render: (r) => (
        <div className="flex items-center gap-2">
          <ProgressBar value={r.percentage} className="w-24" />
          <b className={(r.percentage ?? 100) >= 70 ? 'text-emerald-600' : 'text-rose-600'}>{pct(r.percentage)}</b>
        </div>
      ),
    },
  ];

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading reports…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Attendance Reports" subtitle="Per-course and per-student summaries with CSV export (doc §31)." />

      <div className="mb-4 flex w-fit rounded-xl bg-slate-200/70 p-1">
        {(['course', 'student'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            {t === 'course' ? 'Course report' : 'Student report'}
          </button>
        ))}
      </div>

      {tab === 'course' ? (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)} className="max-w-xs">
              <option value="" disabled>
                Select a course…
              </option>
              {(data?.courses ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </Select>
            <Button variant="secondary" size="sm" onClick={exportCourse} disabled={!courseId || !courseRows?.length}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
          {!courseId ? (
            <EmptyState icon={<BarChart3 className="h-7 w-7" />} title="Choose a course" message="Select a course above to see its per-student attendance summary." />
          ) : (
            <DataTable
              columns={courseColumns}
              rows={courseRows ?? []}
              keyOf={(r) => r.student.id}
              loadingNote={loadingCourse ? 'Generating report…' : undefined}
              mobileCard={(r) => (
                <div>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{r.student.profile?.fullName}</p>
                      <p className="font-mono text-xs text-slate-500">{r.student.studentNumber}</p>
                    </div>
                    <b className={((r.percentage ?? 100) >= 70 ? 'text-emerald-600' : 'text-rose-600')}>{pct(r.percentage)}</b>
                  </div>
                  <ProgressBar value={r.percentage} className="mt-2" />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Present {r.present} · Late {r.late} · Absent {r.absent} of {r.sessionsHeld} sessions
                  </p>
                </div>
              )}
              empty={<EmptyState title="No data" message="This course has no attendance history yet." />}
            />
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
            <Select value={studentId} onChange={(e) => setStudentId(e.target.value)} className="max-w-xs">
              <option value="" disabled>
                Select a student…
              </option>
              {(data?.students ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.profile?.fullName} ({s.studentNumber})
                </option>
              ))}
            </Select>
            <Button variant="secondary" size="sm" onClick={exportStudent} disabled={!studentId || !studentRows?.length}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
          {!studentId ? (
            <EmptyState icon={<BarChart3 className="h-7 w-7" />} title="Choose a student" message="Select a student above to see attendance across all their courses." />
          ) : (
            <DataTable
              columns={studentColumns}
              rows={studentRows ?? []}
              keyOf={(r) => r.course.id}
              loadingNote={loadingStudent ? 'Generating report…' : undefined}
              mobileCard={(r) => (
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">{r.course.code} — {r.course.title}</p>
                    <b className={((r.percentage ?? 100) >= 70 ? 'text-emerald-600' : 'text-rose-600')}>{pct(r.percentage)}</b>
                  </div>
                  <ProgressBar value={r.percentage} className="mt-2" />
                  <p className="mt-1.5 text-xs text-slate-500">
                    Attended {r.attended} of {r.sessionsHeld} sessions
                  </p>
                </div>
              )}
              empty={<EmptyState title="No enrollments" message="This student is not enrolled in any course yet." />}
            />
          )}
        </Card>
      )}
    </>
  );
}
