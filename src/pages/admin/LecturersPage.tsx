import { useState } from 'react';
import { Pencil, Plus, Power, Trash2, Users } from 'lucide-react';
import { ActiveBadge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, SearchInput, Select } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { useToast } from '../../components/toast';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import type { Department, Lecturer } from '../../types';

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  staffNumber: string;
  departmentId: string;
  password: string;
}

const emptyForm: FormState = { fullName: '', email: '', phone: '', staffNumber: '', departmentId: '', password: '' };

export function LecturersPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Lecturer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Lecturer | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync<{ lecturers: Lecturer[]; departments: Department[] }>(async () => {
    const [lecturers, departments] = await Promise.all([backend.listLecturers(), backend.listDepartments()]);
    return { lecturers, departments };
  }, []);

  const departments = data?.departments ?? [];
  const lecturers = (data?.lecturers ?? []).filter((l) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (l.profile?.fullName ?? '').toLowerCase().includes(q) || l.staffNumber.toLowerCase().includes(q);
  });

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, departmentId: departments[0]?.id ?? '' });
    setModalOpen(true);
  };

  const openEdit = (l: Lecturer) => {
    setEditing(l);
    setForm({
      fullName: l.profile?.fullName ?? '',
      email: l.profile?.email ?? '',
      phone: l.profile?.phone ?? '',
      staffNumber: l.staffNumber,
      departmentId: l.departmentId,
      password: '',
    });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
        staffNumber: form.staffNumber,
        departmentId: form.departmentId,
      };
      if (editing) {
        await backend.updateLecturer(editing.id, payload);
        toast.success('Lecturer updated.');
      } else {
        await backend.createLecturer({ ...payload, password: form.password || undefined });
        toast.success(`Lecturer ${payload.fullName} added. Initial password: ${form.password || 'demo1234'}`);
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (l: Lecturer) => {
    try {
      await backend.updateLecturer(l.id, { isActive: !l.isActive });
      toast.success(`${l.profile?.fullName ?? 'Lecturer'} ${l.isActive ? 'deactivated' : 'reactivated'}.`);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await backend.deleteLecturer(confirmDelete.id);
      toast.success('Lecturer deleted.');
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Lecturer>[] = [
    {
      header: 'Lecturer',
      render: (l) => (
        <div>
          <p className="font-semibold text-slate-900">{l.profile?.fullName ?? '—'}</p>
          <p className="text-xs text-slate-500">{l.profile?.email}</p>
        </div>
      ),
    },
    { header: 'Staff no.', render: (l) => <span className="font-mono text-xs">{l.staffNumber}</span> },
    { header: 'Department', render: (l) => l.department?.name ?? '—' },
    { header: 'Status', render: (l) => <ActiveBadge active={l.isActive} /> },
    {
      header: 'Actions',
      className: 'text-right',
      render: (l) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(l)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => toggleActive(l)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-600" title={l.isActive ? 'Deactivate' : 'Reactivate'}>
            <Power className="h-4 w-4" />
          </button>
          <button onClick={() => setConfirmDelete(l)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading lecturers…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Lecturers"
        subtitle="Manage lecturer accounts. Use Assignments to attach them to courses."
        action={
          <Button onClick={openCreate} disabled={departments.length === 0}>
            <Plus className="h-4 w-4" /> Add lecturer
          </Button>
        }
      />

      <div className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or staff number…" />
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={lecturers}
          keyOf={(l) => l.id}
          mobileCard={(l) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{l.profile?.fullName}</p>
                  <p className="font-mono text-xs text-slate-500">{l.staffNumber}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{l.department?.name}</p>
                </div>
                <ActiveBadge active={l.isActive} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(l)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="secondary" size="sm" onClick={() => toggleActive(l)}>
                  <Power className="h-3.5 w-3.5" /> {l.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(l)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
          empty={
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="No lecturers found"
              message={search ? 'No lecturers match your search.' : 'Add your first lecturer to get started.'}
            />
          }
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit lecturer' : 'Add lecturer'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name" required>
            <Input value={form.fullName} onChange={set('fullName')} placeholder="e.g. Dr. Funmi Adeyemi" required />
          </Field>
          <Field label="Email" required>
            <Input type="email" autoCapitalize="none" value={form.email} onChange={set('email')} placeholder="lecturer@institution.edu" required />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="+234 …" />
          </Field>
          <Field label="Staff number" required hint="Must be unique — e.g. LC/001">
            <Input value={form.staffNumber} onChange={set('staffNumber')} placeholder="LC/001" required />
          </Field>
          <Field label="Department" required>
            <Select value={form.departmentId} onChange={set('departmentId')} required>
              <option value="" disabled>
                Select…
              </option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </Select>
          </Field>
          {!editing && (
            <Field label="Initial password" hint="Share this with the lecturer for their first sign-in. Defaults to demo1234.">
              <Input value={form.password} onChange={set('password')} autoComplete="off" placeholder="demo1234" />
            </Field>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {editing ? 'Save changes' : 'Add lecturer'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete lecturer?"
        message={
          <>
            This will permanently delete <b>{confirmDelete?.profile?.fullName}</b> ({confirmDelete?.staffNumber}) and
            their course assignments. This action cannot be easily undone.
          </>
        }
        loading={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
