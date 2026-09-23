import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut, Save, UserCog } from 'lucide-react';
import { Button, Card, Field, Input, PageHeader } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../components/toast';
import { backend } from '../../services';
import { errMessage } from '../../lib/errors';
import { useAsync } from '../../hooks/useAsync';
import type { Student } from '../../types';

export function StudentProfilePage() {
  const { profile, refresh, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const { data: student } = useAsync<Student | null>(async () => {
    if (!profile) return null;
    return backend.getStudentByProfile(profile.id);
  }, [profile?.id]);

  const [fullName, setFullName] = useState(profile?.fullName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentSummary, setCurrentSummary] = useState('');
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
      setCurrentSummary('');
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
      <PageHeader title="My Profile" subtitle="Your account details and security settings." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <UserCog className="h-5 w-5 text-slate-400" /> Account information
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 text-sm ring-1 ring-inset ring-slate-200">
            <div>
              <dt className="text-xs text-slate-500">Matric number</dt>
              <dd className="font-semibold text-slate-900">{student?.studentNumber ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Level</dt>
              <dd className="font-semibold text-slate-900">{student?.level ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Department</dt>
              <dd className="font-semibold text-slate-900">{student?.department?.name ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Email</dt>
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
              <Field label="Current password" hint="Demo mode: any value is accepted.">
                <Input type="password" value={currentSummary} autoComplete="current-password" onChange={(e) => setCurrentSummary(e.target.value)} />
              </Field>
              <Field label="New password" hint="At least 8 characters.">
                <Input type="password" value={newPassword} autoComplete="new-password" onChange={(e) => setNewPassword(e.target.value)} />
              </Field>
              <Field label="Confirm new password">
                <Input type="password" value={confirmPassword} autoComplete="new-password" onChange={(e) => setConfirmPassword(e.target.value)} />
              </Field>
              <Button type="submit" loading={savingPassword} variant="secondary">
                Update password
              </Button>
            </form>
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
