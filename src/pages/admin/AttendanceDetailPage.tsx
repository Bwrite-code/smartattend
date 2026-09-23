import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download } from 'lucide-react';
import { AttendanceStatusBadge, Badge, Button, Card, EmptyState, ErrorState, PageHeader, SessionStatusBadge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { downloadCsv } from '../../lib/csv';
import { fmtDate, fmtDateTime, fmtTime, pct } from '../../lib/format';
import type { AttendanceRecord } from '../../types';
import type { AttendanceSessionWithStats } from '../../services/types';

export function AdminAttendanceDetailPage() {
  const { id = '' } = useParams();
  const { data, loading, error, reload } = useAsync<{ session: AttendanceSessionWithStats; records: AttendanceRecord[] }>(async () => {
    const [session, records] = await Promise.all([backend.getAttendanceSession(id), backend.listAttendanceRecords({ sessionId: id })]);
    return { session, records };
  }, [id]);

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading session…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;
  if (!data) return null;
  const { session, records } = data;

  const columns: Column<AttendanceRecord>[] = [
    {
      header: 'Student',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.student?.profile?.fullName ?? '—'}</p>
          <p className="font-mono text-xs text-slate-500">{r.student?.studentNumber}</p>
        </div>
      ),
    },
    { header: 'Marked at', render: (r) => fmtDateTime(r.markedAt) },
    { header: 'Status', render: (r) => <AttendanceStatusBadge status={r.status} /> },
    { header: 'Method', render: (r) => <Badge tone={r.method === 'qr' ? 'indigo' : 'slate'}>{r.method === 'qr' ? 'QR scan' : 'Manual'}</Badge> },
  ];

  return (
    <>
      <Link to="/admin/attendance" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> All sessions
      </Link>
      <PageHeader
        title={`${session.course?.code ?? 'Session'} — ${fmtDate(session.sessionDate)}`}
        subtitle={`${session.course?.title ?? ''} · ${session.lecturer?.profile?.fullName ?? ''} · started ${fmtTime(session.startTime)}`}
        action={
          <div className="flex items-center gap-2">
            <SessionStatusBadge status={session.status} />
            <Button variant="secondary" size="sm" onClick={() =>
              downloadCsv(
                `attendance-${session.course?.code}-${session.sessionDate}.csv`,
                ['Student Name', 'Matric Number', 'Status', 'Method', 'Marked At'],
                records.map((r) => [r.student?.profile?.fullName ?? '', r.student?.studentNumber ?? '', r.status, r.method, fmtDateTime(r.markedAt)])
              )
            } disabled={records.length === 0}>
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Attended</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{session.stats.present + session.stats.late}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Enrolled</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{session.stats.enrolled}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500">Rate</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{pct(session.rate)}</p>
        </Card>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={records}
          keyOf={(r) => r.id}
          mobileCard={(r) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{r.student?.profile?.fullName}</p>
                <p className="font-mono text-xs text-slate-500">{r.student?.studentNumber}</p>
                <p className="mt-0.5 text-xs text-slate-400">{fmtDateTime(r.markedAt)} · {r.method === 'qr' ? 'QR scan' : 'Manual'}</p>
              </div>
              <AttendanceStatusBadge status={r.status} />
            </div>
          )}
          empty={<EmptyState title="No records" message="No attendance was recorded for this session." />}
        />
      </Card>
    </>
  );
}
