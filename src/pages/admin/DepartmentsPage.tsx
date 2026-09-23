import { useState } from 'react';
import { Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { useToast } from '../../components/toast';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import type { Department } from '../../types';

export function DepartmentsPage() {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState({ name: '', code: '' });
  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync<Department[]>(() => backend.listDepartments(), []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', code: '' });
    setModalOpen(true);
  };

  const openEdit = (d: Department) => {
    setEditing(d);
    setForm({ name: d.name, code: d.code });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editing) {
        await backend.updateDepartment(editing.id, form);
        toast.success('Department updated.');
      } else {
        await backend.createDepartment(form);
        toast.success('Department created.');
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
      await backend.deleteDepartment(confirmDelete.id);
      toast.success('Department deleted.');
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Department>[] = [
    { header: 'Name', render: (d) => <span className="font-semibold text-slate-900">{d.name}</span> },
    { header: 'Code', render: (d) => <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">{d.code}</span> },
    {
      header: 'Actions',
      className: 'text-right',
      render: (d) => (
        <div className="flex justify-end gap-1">
          <button onClick={() => openEdit(d)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => setConfirmDelete(d)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading departments…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Departments"
        subtitle="Academic departments in the institution."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add department
          </Button>
        }
      />
      <Card>
        <DataTable
          columns={columns}
          rows={data ?? []}
          keyOf={(d) => d.id}
          mobileCard={(d) => (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">{d.name}</p>
                <p className="font-mono text-xs text-slate-500">{d.code}</p>
              </div>
              <div className="flex gap-1">
                <Button variant="secondary" size="sm" onClick={() => openEdit(d)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="danger" size="sm" onClick={() => setConfirmDelete(d)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
          empty={
            <EmptyState
              icon={<Building2 className="h-7 w-7" />}
              title="No departments yet"
              message="Create your first department — students, lecturers and courses are organised under departments."
            />
          }
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit department' : 'Add department'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Department name" required>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Computer Science" required />
          </Field>
          <Field label="Code" required hint="Short unique code — e.g. CSC">
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="CSC" required />
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {editing ? 'Save changes' : 'Create department'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete department?"
        message={
          <>
            Delete <b>{confirmDelete?.name}</b>? Departments with students, lecturers or courses attached cannot be
            deleted.
          </>
        }
        loading={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
