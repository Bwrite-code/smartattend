import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { ArrowLeft, Copy, Download, PauseCircle, RefreshCw, Timer, UserCheck, Users } from 'lucide-react';
import { AttendanceStatusBadge, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, PageHeader, ProgressBar, Select, SessionStatusBadge } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { useToast } from '../../components/toast';
import { backend } from '../../services';
import { useAsync, useInterval } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { downloadCsv } from '../../lib/csv';
import { fmtDate, fmtDateTime, fmtTime, pct } from '../../lib/format';
import type { AttendanceRecord, Student } from '../../types';
import type { AttendanceSessionWithStats } from '../../services/types';

const DEFAULT_DURATION = 15;

export function LecturerSessionDetailPage() {
  const { id = '' } = useParams();
  const toast = useToast();
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<'refresh' | 'close' | 'cancel' | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');
  const [marking, setMarking] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([
        backend.getAttendanceSession(id),
        backend.listAttendanceRecords({ sessionId: id }),
      ]),
    [id]
  );
  const { data, loading, error, reload } = useAsync<[AttendanceSessionWithStats, AttendanceRecord[]]>(load, [id]);

  const session = data?.[0];
  const records = data?.[1] ?? [];
  const isActive = session?.status === 'active';
  const expired = session ? new Date(session.qrExpiresAt).getTime() < now : false;

  // Live updates: poll while the session is open (doc §48 monitor attendance)
  useInterval(() => {
    if (isActive) reload();
  }, isActive ? 5000 : null);

  // 1-second tick for the token countdown
  useEffect(() => {
    if (!isActive) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [isActive]);

  // Generate the QR image for the deep link (doc §24)
  useEffect(() => {
    if (!session) return;
    const url = `${window.location.origin}/attend/${encodeURIComponent(session.qrToken)}`;
    QRCode.toDataURL(url, { width: 512, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(null));
  }, [session?.qrToken, session?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const attended = records.filter((r) => r.status === 'present' || r.status === 'late').length;

  // Students not yet marked — for manual marking (doc §25 lecturer confirmation)
  const { data: roster } = useAsync<Student[]>(async () => {
    if (!session) return [];
    return backend.getCourseRoster(session.courseId, session.academicSessionId);
  }, [session?.courseId, session?.academicSessionId]);

  const unmarked = useMemo(() => {
    const marked = new Set(records.map((r) => r.studentId));
    return (roster ?? []).filter((s) => !marked.has(s.id));
  }, [roster, records]);

  const refreshCode = async () => {
    setBusy('refresh');
    try {
      await backend.regenerateSessionToken(id, DEFAULT_DURATION);
      await reload();
      toast.success(`QR code refreshed — valid for another ${DEFAULT_DURATION} minutes.`);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const closeSession = async () => {
    setBusy('close');
    try {
      await backend.setSessionStatus(id, 'closed');
      await reload();
      toast.success('Attendance session closed.');
      setConfirmClose(false);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const cancelSession = async () => {
    setBusy('cancel');
    try {
      await backend.setSessionStatus(id, 'cancelled');
      await reload();
      toast.info('Session cancelled.');
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const markManual = async () => {
    if (!manualStudentId) return;
    setMarking(true);
    try {
      await backend.markAttendanceManual(id, manualStudentId, 'present');
      await reload();
      toast.success('Marked present (manual entry).');
      setManualStudentId('');
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setMarking(false);
    }
  };

  const removeRecord = async (recordId: string) => {
    try {
      await backend.deleteAttendanceRecord(recordId);
      await reload();
      toast.info('Record removed.');
    } catch (err) {
      toast.error(errMessage(err));
    }
  };

  const exportCsv = () => {
    if (!session) return;
    downloadCsv(
      `attendance-${session.course?.code ?? 'session'}-${session.sessionDate}.csv`,
      ['Student Name', 'Matric Number', 'Status', 'Method', 'Marked At'],
      records.map((r) => [
        r.student?.profile?.fullName ?? '',
        r.student?.studentNumber ?? '',
        r.status,
        r.method,
        fmtDateTime(r.markedAt),
      ])
    );
  };

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading session…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;
  if (!session) return null;

  const remainingMs = Math.max(0, new Date(session.qrExpiresAt).getTime() - now);
  const mins = Math.floor(remainingMs / 60000);
  const secs = Math.floor((remainingMs % 60000) / 1000);

  const columns: Column<AttendanceRecord>[] = [
    {
      header: 'Student',
      render: (r) => (
        <div>
          <p className="font-semibold text-slate-900">{r.student?.profile?.fullName ?? 'Unknown'}</p>
          <p className="font-mono text-xs text-slate-500">{r.student?.studentNumber}</p>
        </div>
      ),
    },
    { header: 'Marked at', render: (r) => fmtTime(new Date(r.markedAt).toTimeString().slice(0, 5)) },
    { header: 'Status', render: (r) => <AttendanceStatusBadge status={r.status} /> },
    { header: 'Method', render: (r) => <Badge tone={r.method === 'qr' ? 'indigo' : 'slate'}>{r.method === 'qr' ? 'QR scan' : 'Manual'}</Badge> },
    {
      header: '',
      className: 'text-right',
      render: (r) => (
        <button onClick={() => removeRecord(r.id)} className="text-xs font-medium text-rose-500 hover:text-rose-700">
          Remove
        </button>
      ),
    },
  ];

  return (
    <>
      <Link to="/lecturer/attendance" className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> All sessions
      </Link>
      <PageHeader
        title={`${session.course?.code ?? 'Session'} — ${fmtDate(session.sessionDate)}`}
        subtitle={`${session.course?.title ?? ''} · Started ${fmtTime(session.startTime)}`}
        action={<SessionStatusBadge status={session.status} />}
      />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        {/* QR panel */}
        <Card className="p-5">
          {isActive && !expired ? (
            <>
              <div className="relative mx-auto w-fit rounded-2xl bg-white p-3 ring-2 ring-emerald-500">
                {qrDataUrl && <img src={qrDataUrl} alt="Attendance QR code" className="h-60 w-60 sm:h-64 sm:w-64" />}
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-0.5 text-xs font-bold text-white shadow">
                  SCAN ME
                </span>
              </div>
              <div className={`mt-4 flex items-center justify-center gap-2 text-sm font-semibold ${mins <= 2 ? 'text-rose-600' : 'text-slate-700'}`}>
                <Timer className="h-4 w-4" />
                {mins <= 2 ? `Expiring in ${mins}:${String(secs).padStart(2, '0')}` : `Valid for ${mins}:${String(secs).padStart(2, '0')} more`}
              </div>
              <ProgressBar value={(remainingMs / (DEFAULT_DURATION * 60000)) * 100} className="mt-2" />
              <p className="mt-3 text-center font-mono text-xs tracking-wider text-slate-500">{session.qrToken}</p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={refreshCode} loading={busy === 'refresh'}>
                  <RefreshCw className="h-4 w-4" /> Refresh code
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    void navigator.clipboard?.writeText(session.qrToken);
                    toast.success('Session code copied.');
                  }}
                >
                  <Copy className="h-4 w-4" /> Copy code
                </Button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="danger" onClick={() => setConfirmClose(true)} loading={busy === 'close'}>
                  <PauseCircle className="h-4 w-4" /> Close session
                </Button>
                <Button variant="ghost" onClick={cancelSession} loading={busy === 'cancel'}>
                  Cancel session
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                <PauseCircle className="h-8 w-8" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">
                  {session.status === 'cancelled' ? 'Session cancelled' : isActive ? 'QR code expired' : 'Session closed'}
                </h2>
                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  {session.status === 'active'
                    ? 'The token has expired — students can no longer scan. Refresh the code to keep taking attendance.'
                    : 'Students can no longer record attendance for this session. Reopen it with a fresh code if this was a mistake.'}
                </p>
              </div>
              {session.status !== 'cancelled' && (
                <Button onClick={refreshCode} loading={busy === 'refresh'}>
                  <RefreshCw className="h-4 w-4" /> {isActive ? 'Refresh code' : 'Reopen with new code'}
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Live attendance panel */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Card className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><UserCheck className="h-4 w-4" /> Attended</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{attended}</p>
            </Card>
            <Card className="p-4">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Users className="h-4 w-4" /> Enrolled</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{session.stats.enrolled}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-slate-500">Rate</p>
              <p className={`mt-1 text-2xl font-bold ${(session.rate ?? 0) >= 70 ? 'text-emerald-600' : 'text-amber-600'}`}>{pct(session.rate)}</p>
            </Card>
          </div>

          {isActive && unmarked.length > 0 && (
            <Card className="p-4">
              <p className="text-sm font-semibold text-slate-900">Mark a student manually</p>
              <p className="mt-0.5 text-xs text-slate-500">For students whose device or camera is not working (recorded as manual).</p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Select value={manualStudentId} onChange={(e) => setManualStudentId(e.target.value)} className="flex-1">
                  <option value="">Select student…</option>
                  {unmarked.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.profile?.fullName} ({s.studentNumber})
                    </option>
                  ))}
                </Select>
                <Button onClick={markManual} loading={marking} disabled={!manualStudentId}>
                  Mark present
                </Button>
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="text-base font-semibold text-slate-900">
                Attendance list {isActive && <span className="ml-1 text-xs font-normal text-slate-400">(live — updates every 5s)</span>}
              </h2>
              <Button variant="secondary" size="sm" onClick={exportCsv} disabled={records.length === 0}>
                <Download className="h-4 w-4" /> CSV
              </Button>
            </div>
            <DataTable
              columns={columns}
              rows={records}
              keyOf={(r) => r.id}
              mobileCard={(r) => (
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{r.student?.profile?.fullName}</p>
                    <p className="font-mono text-xs text-slate-500">{r.student?.studentNumber} · {fmtTime(new Date(r.markedAt).toTimeString().slice(0, 5))}</p>
                  </div>
                  <AttendanceStatusBadge status={r.status} />
                </div>
              )}
              empty={
                <EmptyState
                  icon={<Users className="h-7 w-7" />}
                  title="No scans yet"
                  message={isActive ? 'Students who scan the QR code will appear here instantly.' : 'No attendance was recorded before this session closed.'}
                />
              }
            />
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirmClose}
        title="Close attendance session?"
        message={
          <>
            Students will no longer be able to scan the QR code. This session will be marked <b>closed</b> and included
            in reports. You can reopen it with a fresh code later.
          </>
        }
        confirmLabel="Close session"
        loading={busy === 'close'}
        onConfirm={closeSession}
        onCancel={() => setConfirmClose(false)}
      />
    </>
  );
}
