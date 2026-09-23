import { History } from 'lucide-react';
import { AttendanceStatusBadge, Badge, Card, EmptyState, ErrorState, PageHeader } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { useAuth } from '../../context/AuthContext';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { fmtDate, fmtTime } from '../../lib/format';
import type { AttendanceRecord } from '../../types';

export function StudentAttendancePage() {
  const { profile } = useAuth();
  const { data, loading, error, reload } = useAsync<AttendanceRecord[]>(async () => {
    if (!profile) throw new Error('Not signed in.');
    const student = await backend.getStudentByProfile(profile.id);
    if (!student) throw new Error('No student record is linked to your account.');
    return backend.listAttendanceRecords({ studentId: student.id });
  }, [profile?.id]);

  const columns: Column<AttendanceRecord>[] = [
    {
      header: 'Course',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.session?.course?.code ?? '—'}</p>
          <p className="text-xs text-slate-500">{r.session?.course?.title}</p>
        </div>
      ),
    },
    { header: 'Date', render: (r) => fmtDate(r.session?.sessionDate ?? '') },
    { header: 'Marked at', render: (r) => fmtTime(new Date(r.markedAt).toTimeString().slice(0, 5)) },
    { header: 'Status', render: (r) => <AttendanceStatusBadge status={r.status} /> },
    { header: 'Method', render: (r) => <Badge tone={r.method === 'qr' ? 'indigo' : 'slate'}>{r.method === 'qr' ? 'QR scan' : 'Manual'}</Badge> },
  ];

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading your attendance history…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader title="Attendance History" subtitle="Every attendance you have recorded, newest first." />
      <Card>
        <DataTable
          columns={columns}
          rows={data ?? []}
          keyOf={(r) => r.id}
          mobileCard={(r) => (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{r.session?.course?.code ?? '—'}</p>
                <p className="text-xs text-slate-500">
                  {fmtDate(r.session?.sessionDate ?? '')} · marked {fmtTime(new Date(r.markedAt).toTimeString().slice(0, 5))}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <AttendanceStatusBadge status={r.status} />
                <Badge tone={r.method === 'qr' ? 'indigo' : 'slate'}>{r.method === 'qr' ? 'QR scan' : 'Manual'}</Badge>
              </div>
            </div>
          )}
          empty={
            <EmptyState
              icon={<History className="h-7 w-7" />}
              title="No attendance recorded yet"
              message="When you scan your first attendance QR code, it will show up here."
            />
          }
        />
      </Card>
    </>
  );
}
