import { useState } from 'react';
import { Link2, Plus, Trash2 } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, Modal, PageHeader, Select } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { useToast } from '../../components/toast';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import type { AcademicSession, Course, Lecturer, LecturerCourse } from '../../types';

export function AssignmentsPage() {
  const toast = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ lecturerId: '', courseId: '', academicSessionId: '' });
  const [confirmRemove, setConfirmRemove] = useState<LecturerCourse | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, loading, error, reload } = useAsync<{
    assignments: LecturerCourse[];
    lecturers: Lecturer[];
    courses: Course[];
    sessions: AcademicSession[];
    activeSessionId: string;
  }>(async () => {
    const [lecturers, courses, sessions, activeSession] = await Promise.all([
      backend.listLecturers(),
      backend.listCourses(),
      backend.listAcademicSessions(),
      backend.getActiveAcademicSession(),
    ]);
    return { assignments: [] as LecturerCourse[], lecturers, courses, sessions, activeSessionId: activeSession?.id ?? '' };
  }, []);

  const effectiveSession = form.academicSessionId || data?.activeSessionId || '';

  const { data: assignments, loading: loadingAssignments, reload: reloadAssignments } = useAsync<LecturerCourse[]>(async () => {
    if (!effectiveSession) return [];
    return backend.listAssignments({ academicSessionId: effectiveSession });
  }, [effectiveSession]);

  const openCreate = () => {
    setForm({
      lecturerId: data?.lecturers[0]?.id ?? '',
      courseId: data?.courses[0]?.id ?? '',
      academicSessionId: data?.activeSessionId ?? '',
    });
    setModalOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await backend.createAssignment({
        lecturerId: form.lecturerId,
        courseId: form.courseId,
        academicSessionId: effectiveSession,
      });
      toast.success('Course assigned to lecturer.');
      setModalOpen(false);
      await reloadAssignments();
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const doRemove = async () => {
    if (!confirmRemove) return;
    setBusy(true);
    try {
      await backend.deleteAssignment(confirmRemove.id);
      toast.success('Assignment removed.');
      setConfirmRemove(null);
      await reloadAssignments();
    } catch (err) {
      toast.error(errMessage(err));
      setConfirmRemove(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<LecturerCourse>[] = [
    {
      header: 'Lecturer',
      render: (a) => (
        <div>
          <p className="font-semibold text-slate-900">{a.lecturer?.profile?.fullName ?? '—'}</p>
          <p className="font-mono text-xs text-slate-500">{a.lecturer?.staffNumber}</p>
        </div>
      ),
    },
    {
      header: 'Course',
      render: (a) => (
        <div>
          <p className="font-semibold text-indigo-600">{a.course?.code}</p>
          <p className="text-xs text-slate-500">{a.course?.title}</p>
        </div>
      ),
    },
    {
      header: 'Session',
      render: (a) => <Badge tone="indigo">{data?.sessions.find((s) => s.id === a.academicSessionId)?.name ?? '—'}</Badge>,
    },
    {
      header: 'Actions',
      className: 'text-right',
      render: (a) => (
        <button onClick={() => setConfirmRemove(a)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Remove assignment">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading assignments…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Course Assignments"
        subtitle="Assign courses to lecturers per academic session (doc §18) — lecturers only see courses assigned to them."
        action={
          <Button onClick={openCreate} disabled={!data?.lecturers.length || !data?.courses.length}>
            <Plus className="h-4 w-4" /> Assign course
          </Button>
        }
      />

      <Card>
        <DataTable
          columns={columns}
          rows={assignments ?? []}
          keyOf={(a) => a.id}
          loadingNote={loadingAssignments ? 'Loading assignments…' : undefined}
          mobileCard={(a) => (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{a.lecturer?.profile?.fullName}</p>
                <p className="text-xs text-indigo-600">
                  {a.course?.code} — {a.course?.title}
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setConfirmRemove(a)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          empty={
            <EmptyState
              icon={<Link2 className="h-7 w-7" />}
              title="No assignments yet"
              message={!effectiveSession ? 'Create and activate an academic session first.' : 'Assign a course to a lecturer so they can start taking attendance.'}
            />
          }
        />
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Assign course to lecturer">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Lecturer" required>
            <Select value={form.lecturerId} onChange={(e) => setForm((f) => ({ ...f, lecturerId: e.target.value }))} required>
              {(data?.lecturers ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.profile?.fullName} ({l.staffNumber})
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Course" required>
            <Select value={form.courseId} onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))} required>
              {(data?.courses ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Academic session" required>
            <Select value={effectiveSession} onChange={(e) => setForm((f) => ({ ...f, academicSessionId: e.target.value }))} required>
              {(data?.sessions ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.id === data?.activeSessionId ? '(active)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Assign course
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        title="Remove assignment?"
        message={
          <>
            Remove <b>{confirmRemove?.course?.code}</b> from <b>{confirmRemove?.lecturer?.profile?.fullName}</b>? Their
            past attendance sessions remain in the system.
          </>
        }
        loading={busy}
        onConfirm={doRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </>
  );
}
