import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlarmClock, BadgeCheck, CalendarDays, CheckCircle2, Clock, ScanLine, XCircle } from 'lucide-react';
import { Button, Card } from '../../components/ui';
import { useAuth, homeForRole } from '../../context/AuthContext';
import { backend } from '../../services';
import { errMessage } from '../../lib/errors';
import type { BackendError } from '../../lib/errors';
import { fmtDate, fmtDateTime, titleCase } from '../../lib/format';
import type { RecordAttendanceResult } from '../../services/types';

/**
 * Deep-link target encoded in every attendance QR code:
 *   {origin}/attend/{TOKEN}
 * A student who scans the QR with any camera app lands here; after signing in
 * they confirm and the token is validated server-side (doc §24, §29).
 */
export function AttendPage() {
  const { token = '' } = useParams();
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RecordAttendanceResult | null>(null);
  const [failure, setFailure] = useState<{ code: string; message: string } | null>(null);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <Centered>
        <Card className="w-full max-w-md p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
            <ScanLine className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Attendance code detected</h1>
          <p className="mt-2 text-sm text-slate-500">
            Sign in with your student account to record your attendance for this session.
          </p>
          <div className="mt-6 space-y-2">
            <Button
              full
              size="lg"
              onClick={() => navigate('/login', { state: { from: `/attend/${token}` } })}
            >
              Sign in to continue
            </Button>
          </div>
        </Card>
      </Centered>
    );
  }

  if (profile.role !== 'student') {
    return (
      <Centered>
        <Card className="w-full max-w-md p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
            <XCircle className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900">Students only</h1>
          <p className="mt-2 text-sm text-slate-500">
            You are signed in as a {profile.role}. Attendance can only be recorded from a student account.
          </p>
          <Button variant="secondary" className="mt-6" full onClick={() => navigate(homeForRole(profile.role))}>
            Go to my dashboard
          </Button>
        </Card>
      </Centered>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    setFailure(null);
    try {
      setResult(await backend.recordAttendanceByToken(token));
    } catch (err) {
      const e = errMessage(err);
      const code = (err as BackendError).code ?? 'unknown';
      setFailure({ code, message: e });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Centered>
      <Card className="w-full max-w-md p-6 sm:p-8">
        {result ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-4 ring-emerald-100">
              <BadgeCheck className="h-9 w-9" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Attendance Recorded</h1>
            <p className="mt-1 text-sm text-slate-500">Your attendance has been recorded successfully.</p>

            <dl className="mt-6 space-y-3 rounded-2xl bg-slate-50 p-4 text-left ring-1 ring-inset ring-slate-200">
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-sm text-slate-500"><CalendarDays className="h-4 w-4" /> Course</dt>
                <dd className="text-sm font-semibold text-slate-900">
                  {result.courseCode} — {result.courseTitle}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-sm text-slate-500"><AlarmClock className="h-4 w-4" /> Date</dt>
                <dd className="text-sm font-semibold text-slate-900">{fmtDate(result.sessionDate)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2 text-sm text-slate-500"><Clock className="h-4 w-4" /> Time</dt>
                <dd className="text-sm font-semibold text-slate-900">{fmtDateTime(result.markedAt).split(', ')[1]}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-sm text-slate-500">Status</dt>
                <dd>
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ring-inset ${result.status === 'present' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'}`}>
                    {titleCase(result.status)}
                  </span>
                </dd>
              </div>
            </dl>

            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => navigate('/student/attendance')}>
                My history
              </Button>
              <Button onClick={() => navigate('/student/scan')}>Scan another</Button>
            </div>
          </div>
        ) : failure ? (
          <div className="text-center">
            <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ring-4 ${failure.code === 'already_marked' ? 'bg-sky-50 text-sky-600 ring-sky-100' : 'bg-rose-50 text-rose-600 ring-rose-100'}`}>
              {failure.code === 'already_marked' ? <CheckCircle2 className="h-9 w-9" /> : <XCircle className="h-9 w-9" />}
            </div>
            <h1 className="text-xl font-bold text-slate-900">
              {failure.code === 'already_marked' ? 'Attendance Already Recorded' : 'Attendance could not be recorded'}
            </h1>
            <p className="mt-2 text-sm text-slate-500">{failure.message}</p>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => navigate('/student')}>
                Dashboard
              </Button>
              <Button onClick={() => navigate('/student/scan')}>Try scanning again</Button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
              <ScanLine className="h-8 w-8" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Confirm your attendance</h1>
            <p className="mt-2 text-sm text-slate-500">
              A valid attendance code was detected. Confirm below and the system will verify your enrollment and record
              your attendance for this session.
            </p>
            <p className="mt-4 break-all rounded-xl bg-slate-50 px-3.5 py-2.5 font-mono text-xs text-slate-600 ring-1 ring-inset ring-slate-200">
              {token}
            </p>
            <Button full size="lg" className="mt-6" loading={submitting} onClick={submit}>
              Record my attendance
            </Button>
            <p className="mt-4 text-xs text-slate-400">
              Signed in as {profile.fullName} · <Link to="/student" className="underline hover:text-slate-500">cancel</Link>
            </p>
          </div>
        )}
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      {children}
    </div>
  );
}
