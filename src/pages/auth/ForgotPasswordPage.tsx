import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Button, Card, Field, Input } from '../../components/ui';
import { backend, backendMode } from '../../services';
import { errMessage } from '../../lib/errors';
import { useToast } from '../../components/toast';

export function ForgotPasswordPage() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError('Enter the email address on your account.');
      return;
    }
    setSubmitting(true);
    try {
      await backend.resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      const msg = errMessage(err);
      setError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-900 px-4 py-10">
      <Card className="w-full max-w-md p-6 sm:p-8">
        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <MailCheck className="h-7 w-7" />
            </div>
            <h1 className="text-lg font-semibold text-slate-900">Check your email</h1>
            <p className="mt-2 text-sm text-slate-500">
              If an account exists for <span className="font-medium text-slate-700">{email}</span>, a password reset
              link has been sent. Follow the link to choose a new password.
            </p>
            {backendMode === 'mock' && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-200">
                Demo mode: no real email is sent. Demo passwords remain <b>demo1234</b>.
              </p>
            )}
          </div>
        ) : (
          <>
            <h1 className="text-lg font-semibold text-slate-900">Reset your password</h1>
            <p className="mt-1 text-sm text-slate-500">
              Enter your account email and we will send you a reset link.
            </p>
            <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
              <Field label="Email address" required>
                <Input
                  type="email"
                  inputMode="email"
                  autoCapitalize="none"
                  placeholder="you@institution.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Field>
              {error && (
                <p className="rounded-xl bg-rose-50 px-3.5 py-2.5 text-sm font-medium text-rose-700 ring-1 ring-inset ring-rose-200" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" full size="lg" loading={submitting}>
                Send reset link
              </Button>
            </form>
          </>
        )}
        <div className="mt-6 text-center">
          <Link to="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </Card>
    </div>
  );
}
