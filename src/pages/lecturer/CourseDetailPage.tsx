import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Play, QrCode, Users } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SessionStatusBadge } from '../../components/ui';
import { StartSessionModal } from '../../components/StartSessionModal';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { downloadCsv } from '../../lib/csv';
import { fmtDate, fmtTime, pct } from '../../lib/format';

export function LecturerCourseDetailPage() {
  const { id = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [startOpen, setStartOpen] = useState(false);

  const { data, loading, error, reload } = useAsync(async () => {
    if (!profile) throw new Error('Not signed in.');
    const lecturer = await backend.getLecturerByProfile(profile.id);
    if (!lecturer) throw new Error('No lecturer record is linked to your account.');
    const activeSession = await backend.getActiveAcademicSession();
    const courses = await backend.listCourses();
    const course = courses.find((c) => c.id === id);
    if (!course) throw new Error('Course not found.');
    const [roster, sessions, summary, assignments] = await Promise.all([
      activeSession ? backend.getCourseRoster(id, activeSession.id) : Promise.resolve([]),
      backend.listAttendanceSessions({ courseId: id }),
      backend.getCourseAttendanceSummary(id),
      backend.listAssignments({ courseId: id }),
    ]);
    const isMine = assignments.some((a) => a.lecturerId === lecturer.id);
    return { course, roster, sessions, summary, activeSession, isMine };
  }, [id, profile?.id]);

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading course…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;
  if (!data) return null;
  const { course, roster, sessions, summary, activeSession, isMine } = data;

  const exportSummary = () => {
    downloadCsv(
      `${course.code}-attendance-report.csv`,
      ['Student Name', 'Matric Number', 'Sessions Held', 'Present', 'Late', 'Absent', 'Attendance %'],
      summary.map((r) => [
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

  return (
    <>
      <Link to="/lecturer/courses" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> My courses
      </Link>
      <PageHeader
        title={`${course.code} — ${course.title}`}
        subtitle={`${course.department?.name ?? ''} · ${course.level} level · ${course.creditUnit} credit units`}
        action={
          isMine && activeSession ? (
            <Button onClick={() => setStartOpen(true)}>
              <Play className="h-4 w-4" /> Start attendance
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Users className="h-5 w-5 text-slate-400" /> Enrolled students ({roster.length})
            </h2>
            {activeSession && <Badge tone="indigo">{activeSession.name}</Badge>}
          </div>
          {roster.length === 0 ? (
            <EmptyState title="No students enrolled" message="Students enrolled in this course (for the active session) will be listed here." />
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {roster.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-4 py-2.5 sm:px-5">
                  <span className="text-sm font-medium text-slate-800">{s.profile?.fullName}</span>
                  <span className="font-mono text-xs text-slate-500">{s.studentNumber}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <h2 className="text-base font-semibold text-slate-900">Attendance report</h2>
            <Button variant="secondary" size="sm" onClick={exportSummary} disabled={summary.length === 0}>
              Export CSV
            </Button>
          </div>
          {summary.length === 0 ? (
            <EmptyState title="No data yet" message="Start an attendance session — the per-student report builds itself as scans come in." />
          ) : (
            <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
              {summary.map((r) => (
                <li key={r.student.id} className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-5">
                  <span className="min-w-0 truncate text-sm font-medium text-slate-800">{r.student.profile?.fullName}</span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {r.present + r.late}/{r.sessionsHeld} · <b className={r.percentage !== null && r.percentage < 70 ? 'text-rose-600' : 'text-emerald-600'}>{pct(r.percentage)}</b>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card className="mt-4">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="text-base font-semibold text-slate-900">Attendance sessions ({sessions.length})</h2>
        </div>
        {sessions.length === 0 ? (
          <EmptyState
            icon={<QrCode className="h-7 w-7" />}
            title="No sessions yet"
            message="Start an attendance session to begin recording attendance for this course."
          />
        ) : (
          <ul className="divide-y divide-slate-100">
            {sessions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => navigate(`/lecturer/attendance/${s.id}`)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-slate-50 sm:px-5"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {fmtDate(s.sessionDate)} · {fmtTime(s.startTime)}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.stats.present + s.stats.late}/{s.stats.enrolled} attended ({pct(s.rate)})
                    </p>
                  </div>
                  <SessionStatusBadge status={s.status} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <StartSessionModal
        open={startOpen}
        onClose={() => setStartOpen(false)}
        courses={[course]}
        lecturerId={sessions[0]?.lecturerId ?? ''}
        academicSessionId={activeSession?.id ?? ''}
        defaultCourseId={course.id}
      />
    </>
  );
}
