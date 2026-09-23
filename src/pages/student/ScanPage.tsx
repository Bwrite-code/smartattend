import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Keyboard, Radio, ScanLine } from 'lucide-react';
import { Button, Card, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { backend, backendMode } from '../../services';
import { errMessage } from '../../lib/errors';
import { useAsync } from '../../hooks/useAsync';

/** Extract the token from either a raw token or a full /attend/{token} URL. */
function extractToken(text: string): string {
  const marker = '/attend/';
  const idx = text.indexOf(marker);
  if (idx >= 0) {
    const rest = text.slice(idx + marker.length);
    return rest.split(/[?#]/)[0] ?? '';
  }
  return text.trim();
}

export function ScanPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [cameraState, setCameraState] = useState<'idle' | 'starting' | 'active' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  // For the demo shortcut: sessions currently open for this student's courses.
  const { data: openData } = useAsync(async () => {
    if (!profile) return null;
    const student = await backend.getStudentByProfile(profile.id);
    if (!student) return null;
    return backend.getStudentStats(student.id);
  }, [profile?.id]);
  const openSessions = openData?.openSessions ?? [];

  const stopCamera = async () => {
    const s = scannerRef.current;
    scannerRef.current = null;
    if (s) {
      try {
        await s.stop();
        s.clear();
      } catch {
        /* already stopped */
      }
    }
    setCameraState('idle');
  };

  const onDecoded = (raw: string) => {
    const token = extractToken(raw);
    if (!token) return;
    void stopCamera();
    navigate(`/attend/${encodeURIComponent(token)}`);
  };

  const startCamera = async () => {
    if (scannerRef.current) return;
    setCameraState('starting');
    setCameraError(null);
    try {
      const scanner = new Html5Qrcode('qr-reader', { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => onDecoded(decodedText),
        () => {
          /* per-frame decode misses are normal — ignore */
        }
      );
      setCameraState('active');
    } catch (err) {
      await stopCamera();
      setCameraState('error');
      setCameraError(
        'Camera could not be started. Check that camera permission is allowed for this site (and that a camera exists). You can still enter the code manually below, or scan the QR with your phone camera app and the link will open here.'
      );
      void errMessage(err);
    }
  };

  useEffect(() => {
    return () => {
      const s = scannerRef.current;
      scannerRef.current = null;
      if (s) {
        s.stop().catch(() => undefined);
      }
    };
  }, []);

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault();
    const token = extractToken(manual);
    if (!token) {
      setManualError('Type or paste the attendance code shown by your lecturer.');
      return;
    }
    setManualError(null);
    navigate(`/attend/${encodeURIComponent(token)}`);
  };

  return (
    <>
      <PageHeader title="Scan Attendance" subtitle="Point your camera at the QR code displayed by your lecturer." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div id="qr-reader" className={`mx-auto w-full ${cameraState === 'active' ? '' : 'hidden'}`} />
          {cameraState !== 'active' && (
            <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
              <div className={`flex h-16 w-16 items-center justify-center rounded-2xl ${cameraState === 'error' ? 'bg-amber-50 text-amber-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {cameraState === 'error' ? <CameraOff className="h-8 w-8" /> : <Camera className="h-8 w-8" />}
              </div>
              {cameraState === 'starting' ? (
                <p className="text-sm text-slate-500">Starting camera…</p>
              ) : (
                <>
                  <p className="max-w-sm text-sm text-slate-500">
                    {cameraError ?? 'Camera access is requested only when you start the scanner. Nothing is recorded or uploaded.'}
                  </p>
                  <Button size="lg" onClick={startCamera}>
                    <Camera className="h-5 w-5" /> Start camera
                  </Button>
                </>
              )}
            </div>
          )}
          {cameraState === 'active' && (
            <div className="border-t border-slate-100 px-4 py-3 text-center">
              <Button variant="secondary" size="sm" onClick={stopCamera}>
                <CameraOff className="h-4 w-4" /> Stop camera
              </Button>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {backendMode === 'mock' && openSessions.length > 0 && (
            <Card className="border-l-4 border-emerald-500 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Radio className="h-4 w-4 text-emerald-600" /> Demo shortcut
              </p>
              <p className="mt-1 text-sm text-slate-500">
                These sessions are open right now. Tap to go straight to attendance confirmation:
              </p>
              <div className="mt-3 space-y-2">
                {openSessions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/attend/${encodeURIComponent(s.qrToken)}`)}
                    className="flex w-full items-center justify-between rounded-xl bg-emerald-50 px-3.5 py-2.5 text-left text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100"
                  >
                    <span>
                      {s.course?.code} — {s.course?.title}
                    </span>
                    <span className="font-mono text-xs">{s.qrToken}</span>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Keyboard className="h-5 w-5 text-slate-400" /> Enter code manually
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              No camera? Type the session code printed under the lecturer's QR code.
            </p>
            <form onSubmit={submitManual} className="mt-3 space-y-3">
              <div className="relative">
                <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  className="block w-full rounded-xl border-0 bg-white py-3 pl-9 pr-3 font-mono text-sm uppercase tracking-widest shadow-sm ring-1 ring-inset ring-slate-300 placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
                  placeholder="e.g. SA-7K2M9QPX4D"
                  value={manual}
                  autoCapitalize="characters"
                  onChange={(e) => setManual(e.target.value)}
                />
              </div>
              {manualError && <p className="text-sm font-medium text-rose-600">{manualError}</p>}
              <Button type="submit" full>
                Submit code
              </Button>
            </form>
          </Card>

          <Card className="p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-slate-900">How it works</h3>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-500">
              <li>Your lecturer opens an attendance session and displays a QR code.</li>
              <li>Scan it here — the code contains a temporary, expiring token.</li>
              <li>The system checks your login, enrollment and duplicate marks before recording you.</li>
            </ol>
          </Card>
        </div>
      </div>
    </>
  );
}
