import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Play, QrCode } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SearchInput, SessionStatusBadge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { StartSessionModal } from '../../components/StartSessionModal';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { fmtDate, fmtTime, pct } from '../../lib/format';
import type { AttendanceSessionWithStats } from '../../services/types';
import type { Course, SessionStatus } from '../../types';

export function LecturerSessionsPage() {
  const { profile } = useAuth();
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SessionStatus>('all');
  const [startOpen, setStartOpen] = useState(false);

  const { data, loading, error, reload } = useAsync<{ lecturerId: string; sessions: AttendanceSessionWithStats[]; courses: Course[]; academicSessionId: string }>(
    async () => {
      if (!profile) throw new Error('Not signed in.');
      const lecturer = await backend.getLecturerByProfile(profile.id);
      if (!lecturer) throw new Error('No lecturer record is linked to your account.');
      const activeSession = await backend.getActiveAcademicSession();
      const [sessions, assignments] = await Promise.all([
        backend.listAttendanceSessions({ lecturerId: lecturer.id }),
        backend.listAssignments({ lecturerId: lecturer.id, academicSessionId: activeSession?.id }),
      ]);
      const courses = assignments.map((a) => a.course).filter((c): c is Course => Boolean(c));
      return { lecturerId: lecturer.id, sessions, courses, academicSessionId: activeSession?.id ?? '' };
    },
    [profile?.id]
  );

  const filtered = useMemo(() => {
    let rows = data?.sessions ?? [];
    if (courseFilter !== 'all') rows = rows.filter((s) => s.courseId === courseFilter);
    if (statusFilter !== 'all') rows = rows.filter((s) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((s) => (s.course?.code ?? '').toLowerCase().includes(q) || s.sessionDate.includes(q));
    }
    return rows;
  }, [data, search, courseFilter, statusFilter]);

  const columns: Column<AttendanceSessionWithStats>[] = [
    { header: 'Course', render: (s) => <span className="font-semibold text-slate-900">{s.course?.code}</span> },
    { header: 'Date', render: (s) => fmtDate(s.sessionDate) },
    { header: 'Start', render: (s) => fmtTime(s.startTime) },
    {
      header: 'Attendance',
      render: (s) => (
        <span className="whitespace-nowrap text-sm">
          <b className="text-slate-900">{s.stats.present + s.stats.late}</b>/{s.stats.enrolled}{' '}
          <span className="text-slate-400">({pct(s.rate)})</span>
        </span>
      ),
    },
    { header: 'Status', render: (s) => <SessionStatusBadge status={s.status} /> },
    {
      header: '',
      className: 'text-right',
      render: (s) => <ChevronRight className="ml-auto h-4 w-4 text-slate-400" />,
    },
  ];

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading attendance sessions…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Attendance Sessions"
        subtitle="Every attendance session you have opened, newest first."
        action={
          <Button onClick={() => setStartOpen(true)} disabled={(data?.courses.length ?? 0) === 0}>
            <Play className="h-4 w-4" /> Start attendance
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by course code or date…" />
        <select
          className="block w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:w-auto"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          aria-label="Filter by course"
        >
          <option value="all">All courses</option>
          {(data?.courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </select>
        <select
          className="block w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | SessionStatus)}
          aria-label="Filter by status"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={filtered}
          keyOf={(s) => s.id}
          mobileCard={(s) => (
            <Link to={`/lecturer/attendance/${s.id}`} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {s.course?.code} · {fmtDate(s.sessionDate)}
                </p>
                <p className="text-xs text-slate-500">
                  {fmtTime(s.startTime)} — {s.stats.present + s.stats.late}/{s.stats.enrolled} attended ({pct(s.rate)})
                </p>
                <div className="mt-1.5"><SessionStatusBadge status={s.status} /></div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
          )}
          empty={
            <EmptyState
              icon={<QrCode className="h-7 w-7" />}
              title="No attendance sessions found"
              message="No sessions match your filters — start an attendance session to begin recording attendance."
              action={<Button onClick={() => setStartOpen(true)}><Play className="h-4 w-4" /> Start attendance</Button>}
            />
          }
        />
      </Card>

      {data && (
        <StartSessionModal
          open={startOpen}
          onClose={() => setStartOpen(false)}
          courses={data.courses}
          lecturerId={data.lecturerId}
          academicSessionId={data.academicSessionId}
        />
      )}
    </>
  );
}
