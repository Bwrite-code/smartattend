import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, KeyRound, LogOut, Save, Server, ShieldCheck, UserCog } from 'lucide-react';
import { Badge, Button, Card, Field, Input, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/toast';
import { backend, backendMode } from '../../services';
import { errMessage } from '../../lib/errors';

export function AdminSettingsPage() {
  const { profile, refresh, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await backend.updateOwnProfile({ fullName, phone });
      await refresh();
      toast.success('Profile updated.');
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      await backend.changePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully.');
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <>
      <PageHeader title="Settings" subtitle="Administrator profile and system information." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <UserCog className="h-5 w-5 text-slate-400" /> Administrator profile
          </h2>
          <dl className="mt-4 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-inset ring-slate-200">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-500">Email</dt>
              <dd className="truncate font-semibold text-slate-900">{profile?.email}</dd>
            </div>
          </dl>
          <form onSubmit={saveProfile} className="mt-4 space-y-4">
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="Phone number">
              <Input value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} placeholder="+234 …" />
            </Field>
            <Button type="submit" loading={savingProfile}>
              <Save className="h-4 w-4" /> Save changes
            </Button>
          </form>
        </Card>

        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <KeyRound className="h-5 w-5 text-slate-400" /> Change password
            </h2>
            <form onSubmit={savePassword} className="mt-4 space-y-4">
              <Field label="New password" hint="At least 8 characters.">
                <Input type="password" value={newPassword} autoComplete="new-password" onChange={(e) => setNewPassword(e.target.value)} />
              </Field>
              <Field label="Confirm new password">
                <Input type="password" value={confirmPassword} autoComplete="new-password" onChange={(e) => setConfirmPassword(e.target.value)} />
              </Field>
              <Button type="submit" variant="secondary" loading={savingPassword}>
                Update password
              </Button>
            </form>
          </Card>

          <Card className="p-4 sm:p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
              <Database className="h-5 w-5 text-slate-400" /> System information
            </h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-slate-500"><Server className="h-4 w-4" /> Backend</dt>
                <dd>
                  <Badge tone={backendMode === 'mock' ? 'amber' : 'green'}>
                    {backendMode === 'mock' ? 'Demo (local sample data)' : 'Supabase (live)'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-slate-500"><ShieldCheck className="h-4 w-4" /> Security</dt>
                <dd className="text-slate-700">
                  {backendMode === 'mock'
                    ? 'Simplified demo logic'
                    : 'RLS policies + Edge Functions'}
                </dd>
              </div>
            </dl>
            {backendMode === 'mock' && (
              <p className="mt-4 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-700 ring-1 ring-inset ring-amber-200">
                You are in demo mode with sample data stored in this browser. To go live, set
                <code className="mx-1 rounded bg-amber-100 px-1 py-0.5 font-mono">VITE_BACKEND_MODE=supabase</code>
                with your project credentials — see the README for the full checklist.
              </p>
            )}
          </Card>

          <Card className="p-4 sm:p-5">
            <Button variant="danger" full onClick={handleSignOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </Card>
        </div>
      </div>
    </>
  );
}
