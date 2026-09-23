import { useMemo, useState } from 'react';
import { GraduationCap, Pencil, Plus, Power, Trash2 } from 'lucide-react';
import { ActiveBadge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, SearchInput, Select } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { useToast } from '../../components/toast';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import type { Department, Student } from '../../types';

interface FormState {
  fullName: string;
  email: string;
  phone: string;
  studentNumber: string;
  departmentId: string;
  level: string;
  password: string;
}

const emptyForm: FormState = { fullName: '', email: '', phone: '', studentNumber: '', departmentId: '', level: '100', password: '' };

export function StudentsPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Student | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Student | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync<{ students: Student[]; departments: Department[] }>(async () => {
    const [students, departments] = await Promise.all([backend.listStudents(), backend.listDepartments()]);
    return { students, departments };
  }, []);

  const departments = data?.departments ?? [];
  const students = useMemo(() => {
    let rows = data?.students ?? [];
    if (deptFilter !== 'all') rows = rows.filter((s) => s.departmentId === deptFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (s) => (s.profile?.fullName ?? '').toLowerCase().includes(q) || s.studentNumber.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [data, search, deptFilter]);

  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, departmentId: departments[0]?.id ?? '' });
    setModalOpen(true);
  };

  const openEdit = (s: Student) => {
    setEditing(s);
    setForm({
      fullName: s.profile?.fullName ?? '',
      email: s.profile?.email ?? '',
      phone: s.profile?.phone ?? '',
      studentNumber: s.studentNumber,
      departmentId: s.departmentId,
      level: String(s.level),
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
        studentNumber: form.studentNumber,
        departmentId: form.departmentId,
        level: Number(form.level) || 100,
      };
      if (editing) {
        await backend.updateStudent(editing.id, payload);
        toast.success('Student updated.');
      } else {
        await backend.createStudent({ ...payload, password: form.password || undefined });
        toast.success(`Student ${payload.fullName} added. Initial password: ${form.password || 'demo1234'}`);
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (s: Student) => {
    try {
      await backend.updateStudent(s.id, { isActive: !s.isActive });
      toast.success(`${s.profile?.fullName ?? 'Student'} ${s.isActive ? 'deactivated' : 'reactivated'}.`);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await backend.deleteStudent(confirmDelete.id);
      toast.success('Student deleted.');
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Student>[] = [
    {
      header: 'Student',
      render: (s) => (
        <div>
          <p className="font-semibold text-slate-900">{s.profile?.fullName ?? '—'}</p>
          <p className="text-xs text-slate-500">{s.profile?.email}</p>
        </div>
      ),
    },
    { header: 'Matric no.', render: (s) => <span className="font-mono text-xs">{s.studentNumber}</span> },
    { header: 'Department', render: (s) => s.department?.name ?? '—' },
    { header: 'Level', className: 'text-center', render: (s) => s.level },
    { header: 'Status', render: (s) => <ActiveBadge active={s.isActive} /> },
    {
      header: 'Actions',
      className: 'text-right',
      render: (s) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(s)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => toggleActive(s)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-amber-600" title={s.isActive ? 'Deactivate' : 'Reactivate'}>
            <Power className="h-4 w-4" />
          </button>
          <button onClick={() => setConfirmDelete(s)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading students…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="Add, edit and monitor student records."
        action={
          <Button onClick={openCreate} disabled={departments.length === 0}>
            <Plus className="h-4 w-4" /> Add student
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or matric number…" />
        <select
          className="block w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:w-auto"
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          aria-label="Filter by department"
        >
          <option value="all">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={students}
          keyOf={(s) => s.id}
          mobileCard={(s) => (
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{s.profile?.fullName}</p>
                  <p className="font-mono text-xs text-slate-500">{s.studentNumber}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {s.department?.name} · {s.level} level
                  </p>
                </div>
                <ActiveBadge active={s.isActive} />
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="secondary" size="sm" className="flex-1" onClick={() => openEdit(s)}>
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </Button>
                <Button variant="secondary" size="sm" onClick={() => toggleActive(s)}>
                  <Power className="h-3.5 w-3.5" /> {s.isActive ? 'Deactivate' : 'Activate'}
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(s)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
          empty={
            <EmptyState
              icon={<GraduationCap className="h-7 w-7" />}
              title="No students found"
              message={search || deptFilter !== 'all' ? 'No students match your search or filter.' : 'Add your first student to get started.'}
            />
          }
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit student' : 'Add student'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Full name" required>
            <Input value={form.fullName} onChange={set('fullName')} placeholder="e.g. Chinedu Okafor" required />
          </Field>
          <Field label="Email" required>
            <Input type="email" autoCapitalize="none" value={form.email} onChange={set('email')} placeholder="student@institution.edu" required />
          </Field>
          <Field label="Phone">
            <Input value={form.phone} onChange={set('phone')} inputMode="tel" placeholder="+234 …" />
          </Field>
          <Field label="Matriculation number" required hint="Must be unique — e.g. CSC/2022/0101">
            <Input value={form.studentNumber} onChange={set('studentNumber')} placeholder="CSC/2022/0101" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
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
            <Field label="Level" required>
              <Select value={form.level} onChange={set('level')}>
                {['100', '200', '300', '400', '500'].map((l) => (
                  <option key={l} value={l}>
                    {l} level
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {!editing && (
            <Field label="Initial password" hint="Share this with the student for their first sign-in. Defaults to demo1234.">
              <Input value={form.password} onChange={set('password')} autoComplete="off" placeholder="demo1234" />
            </Field>
          )}
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {editing ? 'Save changes' : 'Add student'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete student?"
        message={
          <>
            This will permanently delete <b>{confirmDelete?.profile?.fullName}</b> ({confirmDelete?.studentNumber}),
            including their enrollments and attendance records. This action cannot be easily undone.
          </>
        }
        loading={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
