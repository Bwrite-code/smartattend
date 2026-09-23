import { useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader, SearchInput, Select } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { useToast } from '../../components/toast';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import type { Course, Department } from '../../types';

interface FormState {
  code: string;
  title: string;
  departmentId: string;
  level: string;
  creditUnit: string;
}

const emptyForm: FormState = { code: '', title: '', departmentId: '', level: '100', creditUnit: '3' };

export function CoursesPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Course | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [confirmDelete, setConfirmDelete] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync<{ courses: Course[]; departments: Department[] }>(async () => {
    const [courses, departments] = await Promise.all([backend.listCourses(), backend.listDepartments()]);
    return { courses, departments };
  }, []);

  const departments = data?.departments ?? [];
  const courses = useMemo(() => {
    let rows = data?.courses ?? [];
    if (deptFilter !== 'all') rows = rows.filter((c) => c.departmentId === deptFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter((c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q));
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

  const openEdit = (c: Course) => {
    setEditing(c);
    setForm({ code: c.code, title: c.title, departmentId: c.departmentId, level: String(c.level), creditUnit: String(c.creditUnit) });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        code: form.code,
        title: form.title,
        departmentId: form.departmentId,
        level: Number(form.level) || 100,
        creditUnit: Number(form.creditUnit) || 3,
      };
      if (editing) {
        await backend.updateCourse(editing.id, payload);
        toast.success('Course updated.');
      } else {
        await backend.createCourse(payload);
        toast.success(`Course ${payload.code} created.`);
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await backend.deleteCourse(confirmDelete.id);
      toast.success('Course deleted.');
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Course>[] = [
    {
      header: 'Course',
      render: (c) => (
        <div>
          <p className="font-semibold text-slate-900">
            {c.code} <span className="font-normal text-slate-600">— {c.title}</span>
          </p>
          <p className="text-xs text-slate-500">{c.department?.name}</p>
        </div>
      ),
    },
    { header: 'Level', className: 'text-center', render: (c) => c.level },
    { header: 'Units', className: 'text-center', render: (c) => c.creditUnit },
    {
      header: 'Actions',
      className: 'text-right',
      render: (c) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setConfirmDelete(c)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading courses…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Courses"
        subtitle="Course catalogue across all departments."
        action={
          <Button onClick={openCreate} disabled={departments.length === 0}>
            <Plus className="h-4 w-4" /> Add course
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto]">
        <SearchInput value={search} onChange={setSearch} placeholder="Search by course code or title…" />
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
          rows={courses}
          keyOf={(c) => c.id}
          mobileCard={(c) => (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-indigo-600">{c.code}</p>
                <p className="text-sm font-semibold text-slate-900">{c.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {c.department?.name} · {c.level} level · {c.creditUnit} units
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="secondary" size="sm" onClick={() => openEdit(c)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(c)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
          empty={
            <EmptyState
              icon={<BookOpen className="h-7 w-7" />}
              title="No courses found"
              message={search || deptFilter !== 'all' ? 'No courses match your search or filter.' : 'Add your first course to get started.'}
            />
          }
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit course' : 'Add course'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Course code" required hint="Unique — e.g. CSC301">
            <Input value={form.code} onChange={set('code')} placeholder="CSC301" required autoCapitalize="characters" />
          </Field>
          <Field label="Course title" required>
            <Input value={form.title} onChange={set('title')} placeholder="e.g. Database Systems" required />
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Level" required>
              <Select value={form.level} onChange={set('level')}>
                {['100', '200', '300', '400', '500'].map((l) => (
                  <option key={l} value={l}>
                    {l} level
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Credit units" required>
              <Select value={form.creditUnit} onChange={set('creditUnit')}>
                {['1', '2', '3', '4', '6'].map((u) => (
                  <option key={u} value={u}>
                    {u} units
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {editing ? 'Save changes' : 'Create course'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete course?"
        message={
          <>
            Delete <b>{confirmDelete?.code} — {confirmDelete?.title}</b>? Its enrollments, assignments and attendance
            history will also be removed. This action cannot be easily undone.
          </>
        }
        loading={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
