import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, GraduationCap, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { Button, Card, Field, Input } from '../../components/ui';
import { useAuth, homeForRole } from '../../context/AuthContext';
import { useToast } from '../../components/toast';
import { backendMode, DEMO_ACCOUNTS } from '../../services';
import { errMessage } from '../../lib/errors';

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const from = (location.state as { from?: string } | null)?.from;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Enter your email address and password.');
      return;
    }
    setSubmitting(true);
    try {
      const profile = await signIn(email.trim(), password);
      toast.success(`Welcome back, ${profile.fullName.split(' ')[0]}!`);
      navigate(from && from !== '/login' ? from : homeForRole(profile.role), { replace: true });
    } catch (err) {
      setError(errMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[linear-gradient(135deg,#07111f_0%,#0d2237_55%,#102d3c_100%)] text-slate-900">
      <div
        className="absolute inset-0 bg-[url('/bg-image.jpeg')] bg-cover bg-center bg-no-repeat opacity-10"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-slate-950/55" aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 py-8 sm:px-8 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(420px,0.95fr)] lg:gap-16 lg:px-12 lg:py-12">
        <section className="mx-auto mb-10 flex w-full max-w-xl flex-col justify-center lg:mb-0">
          <div className="flex items-center gap-3">
            <img src="/icon.svg" alt="" className="h-11 w-11 rounded-xl shadow-lg shadow-cyan-950/30 ring-1 ring-white/15" />
            <span className="text-lg font-bold tracking-tight text-white">SmartAttend</span>
          </div>
          <div className="mt-10 max-w-lg sm:mt-16">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" /> Attendance, made visible
            </p>
            <h1 className="text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-6xl">
              Start every class with confidence.
            </h1>
            <p className="mt-5 max-w-md text-base leading-7 text-slate-300 sm:text-lg">
              One calm place for administrators, lecturers and students to keep attendance accurate and moving forward.
            </p>
            <div className="mt-8 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
              {['Fast QR check-ins', 'Live session visibility', 'Clear attendance records', 'Built for every device'].map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-cyan-300" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-10 text-xs text-slate-500 lg:mt-16">Secure access for your institution</p>
        </section>

        <section className="flex w-full items-center justify-center">
          <Card className="w-full max-w-md border-0 p-6 shadow-2xl shadow-slate-950/30 sm:p-8">
            <div className="mb-7">
              <p className="text-sm font-semibold text-cyan-700">Welcome back</p>
              <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Sign in to SmartAttend</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Use your institution account to continue to your personalized workspace.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4" noValidate>
              <Field label="Email address" required>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    autoCapitalize="none"
                    className="pl-9"
                    placeholder="you@institution.edu"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </Field>
              <Field label="Password" required>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    type="password"
                    autoComplete="current-password"
                    className="pl-9"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </Field>

            {error && (
              <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200" role="alert">
                {error}
              </p>
            )}

              <Button type="submit" full size="lg" loading={submitting}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </form>

            <div className="mt-4 text-center">
              <Link to="/forgot-password" className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
                Forgot your password?
              </Link>
            </div>

            {backendMode === 'mock' && (
              <div className="mt-7 rounded-2xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
                  <ShieldCheck className="h-4 w-4" /> Demo mode — quick sign-in
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Pick a role to explore the full system. Password is pre-filled ({DEMO_ACCOUNTS[0].password}).
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {DEMO_ACCOUNTS.map((acct) => (
                    <button
                      key={acct.role}
                      type="button"
                      onClick={() => {
                        setEmail(acct.email);
                        setPassword(acct.password);
                        setError(null);
                      }}
                      className="flex flex-col items-center gap-1 rounded-xl bg-white px-2 py-2.5 text-xs font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:-translate-y-0.5 hover:ring-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-600"
                    >
                      {acct.role === 'admin' && <ShieldCheck className="h-4 w-4 text-cyan-600" />}
                      {acct.role === 'lecturer' && <GraduationCap className="h-4 w-4 text-cyan-600" />}
                      {acct.role === 'student' && <Mail className="h-4 w-4 text-cyan-600" />}
                      {acct.role.charAt(0).toUpperCase() + acct.role.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>
      <p className="absolute bottom-4 left-0 right-0 text-center text-[11px] text-slate-600">
        SmartAttend works on phones, tablets and desktops.
      </p>
    </div>
  );
}
