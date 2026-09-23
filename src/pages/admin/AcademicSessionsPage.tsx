import { useState } from 'react';
import { CalendarRange, CheckCircle2, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Input, Modal, PageHeader } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { useToast } from '../../components/toast';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import { fmtDate } from '../../lib/format';
import type { AcademicSession } from '../../types';

export function AcademicSessionsPage() {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicSession | null>(null);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '' });
  const [confirmDelete, setConfirmDelete] = useState<AcademicSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [activating, setActivating] = useState<string | null>(null);

  const { data, loading, error, reload } = useAsync<AcademicSession[]>(() => backend.listAcademicSessions(), []);

  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', startDate: '', endDate: '' });
    setModalOpen(true);
  };

  const openEdit = (s: AcademicSession) => {
    setEditing(s);
    setForm({ name: s.name, startDate: s.startDate, endDate: s.endDate });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.endDate < form.startDate) {
      toast.error('End date must be after the start date.');
      return;
    }
    setBusy(true);
    try {
      if (editing) {
        await backend.updateAcademicSession(editing.id, form);
        toast.success('Academic session updated.');
      } else {
        await backend.createAcademicSession(form);
        toast.success('Academic session created. Activate it to put it into use.');
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const activate = async (s: AcademicSession) => {
    setActivating(s.id);
    try {
      await backend.activateAcademicSession(s.id);
      toast.success(`${s.name} is now the active academic session.`);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setActivating(null);
    }
  };

  const doDelete = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    try {
      await backend.deleteAcademicSession(confirmDelete.id);
      toast.success('Academic session deleted.');
      setConfirmDelete(null);
      await reload();
    } catch (err) {
      toast.error(errMessage(err));
      setConfirmDelete(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<AcademicSession>[] = [
    {
      header: 'Session',
      render: (s) => (
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-900">{s.name}</span>
          {s.isActive && <Badge tone="green">Active</Badge>}
        </div>
      ),
    },
    { header: 'Starts', render: (s) => fmtDate(s.startDate) },
    { header: 'Ends', render: (s) => fmtDate(s.endDate) },
    {
      header: 'Actions',
      className: 'text-right',
      render: (s) => (
        <div className="flex justify-end gap-1.5">
          {!s.isActive && (
            <Button variant="secondary" size="sm" onClick={() => activate(s)} loading={activating === s.id}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Activate
            </Button>
          )}
          <button onClick={() => openEdit(s)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-indigo-600" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          {!s.isActive && (
            <button onClick={() => setConfirmDelete(s)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading academic sessions…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Academic Sessions"
        subtitle="Exactly one session is active at a time — enrollments and assignments are organised per session."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Add session
          </Button>
        }
      />
      <Card>
        <DataTable
          columns={columns}
          rows={data ?? []}
          keyOf={(s) => s.id}
          mobileCard={(s) => (
            <div>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{s.name}</p>
                {s.isActive ? <Badge tone="green">Active</Badge> : null}
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                {fmtDate(s.startDate)} → {fmtDate(s.endDate)}
              </p>
              <div className="mt-3 flex gap-2">
                {!s.isActive && (
                  <Button variant="secondary" size="sm" className="flex-1" onClick={() => activate(s)} loading={activating === s.id}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Activate
                  </Button>
                )}
                <Button variant="secondary" size="sm" onClick={() => openEdit(s)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                {!s.isActive && (
                  <Button variant="danger" size="sm" onClick={() => setConfirmDelete(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
          empty={
            <EmptyState
              icon={<CalendarRange className="h-7 w-7" />}
              title="No academic sessions yet"
              message="Create a session such as 2026/2027 and activate it to begin enrolling students."
            />
          }
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit academic session' : 'Add academic session'}>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Session name" required hint="e.g. 2026/2027">
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="2026/2027" required />
          </Field>
          <Field label="Start date" required>
            <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} required />
          </Field>
          <Field label="End date" required>
            <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} required />
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {editing ? 'Save changes' : 'Create session'}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        title="Delete academic session?"
        message={
          <>
            Delete <b>{confirmDelete?.name}</b>? Enrollments and lecturer assignments belonging to this session will be
            removed. Attendance history may also be affected.
          </>
        }
        loading={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
