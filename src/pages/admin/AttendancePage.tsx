import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, ClipboardList } from 'lucide-react';
import { Card, EmptyState, ErrorState, PageHeader, SearchInput, SessionStatusBadge, Select } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { fmtDate, fmtTime, pct } from '../../lib/format';
import type { AttendanceSessionWithStats } from '../../services/types';
import type { Course, Lecturer, SessionStatus } from '../../types';

export function AdminAttendancePage() {
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('all');
  const [lecturerFilter, setLecturerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | SessionStatus>('all');

  const { data, loading, error, reload } = useAsync<{ sessions: AttendanceSessionWithStats[]; courses: Course[]; lecturers: Lecturer[] }>(
    async () => {
      const [sessions, courses, lecturers] = await Promise.all([
        backend.listAttendanceSessions(),
        backend.listCourses(),
        backend.listLecturers(),
      ]);
      return { sessions, courses, lecturers };
    },
    []
  );

  const filtered = useMemo(() => {
    let rows = data?.sessions ?? [];
    if (courseFilter !== 'all') rows = rows.filter((s) => s.courseId === courseFilter);
    if (lecturerFilter !== 'all') rows = rows.filter((s) => s.lecturerId === lecturerFilter);
    if (statusFilter !== 'all') rows = rows.filter((s) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (s) => (s.course?.code ?? '').toLowerCase().includes(q) || s.sessionDate.includes(q) || (s.lecturer?.profile?.fullName ?? '').toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, search, courseFilter, lecturerFilter, statusFilter]);

  const columns: Column<AttendanceSessionWithStats>[] = [
    {
      header: 'Session',
      render: (s) => (
        <div>
          <p className="font-semibold text-slate-900">
            {s.course?.code} — {fmtDate(s.sessionDate)}
          </p>
          <p className="text-xs text-slate-500">{s.lecturer?.profile?.fullName}</p>
        </div>
      ),
    },
    { header: 'Started', render: (s) => fmtTime(s.startTime) },
    {
      header: 'Attendance',
      render: (s) => (
        <span className="whitespace-nowrap">
          <b>{s.stats.present + s.stats.late}</b>/{s.stats.enrolled} <span className="text-slate-400">({pct(s.rate)})</span>
        </span>
      ),
    },
    { header: 'Status', render: (s) => <SessionStatusBadge status={s.status} /> },
    { header: '', className: 'text-right', render: () => <ChevronRight className="ml-auto h-4 w-4 text-slate-400" /> },
  ];

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading attendance sessions…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Attendance Records" subtitle="All attendance sessions opened by lecturers (doc §26)." />

      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search course, lecturer or date…" />
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)} aria-label="Filter by course">
          <option value="all">All courses</option>
          {(data?.courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code}
            </option>
          ))}
        </Select>
        <Select value={lecturerFilter} onChange={(e) => setLecturerFilter(e.target.value)} aria-label="Filter by lecturer">
          <option value="all">All lecturers</option>
          {(data?.lecturers ?? []).map((l) => (
            <option key={l.id} value={l.id}>
              {l.profile?.fullName}
            </option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as 'all' | SessionStatus)} aria-label="Filter by status">
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
          <option value="cancelled">Cancelled</option>
        </Select>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={filtered}
          keyOf={(s) => s.id}
          mobileCard={(s) => (
            <Link to={`/admin/attendance/${s.id}`} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  {s.course?.code} · {fmtDate(s.sessionDate)}
                </p>
                <p className="text-xs text-slate-500">
                  {s.lecturer?.profile?.fullName} — {s.stats.present + s.stats.late}/{s.stats.enrolled} ({pct(s.rate)})
                </p>
                <div className="mt-1.5">
                  <SessionStatusBadge status={s.status} />
                </div>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" />
            </Link>
          )}
          empty={
            <EmptyState
              icon={<ClipboardList className="h-7 w-7" />}
              title="No attendance sessions found"
              message="Sessions opened by lecturers will appear here. Adjust your filters if you expected results."
            />
          }
        />
      </Card>
    </>
  );
}
