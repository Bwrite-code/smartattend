import { useMemo, useState } from 'react';
import { CheckSquare, Search, Square, Trash2, UserPlus } from 'lucide-react';
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Modal, PageHeader, SearchInput, Select } from '../../components/ui';
import { DataTable } from '../../components/DataTable';
import type { Column } from '../../components/DataTable';
import { useToast } from '../../components/toast';
import { backend } from '../../services';
import { useAsync } from '../../hooks/useAsync';
import { errMessage } from '../../lib/errors';
import type { AcademicSession, Course, Enrollment, Student } from '../../types';

export function EnrollmentsPage() {
  const toast = useToast();
  const [courseFilter, setCourseFilter] = useState('all');
  const [sessionId, setSessionId] = useState('');
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollCourse, setEnrollCourse] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [studentSearch, setStudentSearch] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<Enrollment | null>(null);
  const [busy, setBusy] = useState(false);
  const [enrolling, setEnrolling] = useState(false);

  const { data, loading, error, reload } = useAsync<
    { enrollments: Enrollment[]; courses: Course[]; sessions: AcademicSession[]; students: Student[]; activeSessionId: string } | null
  >(async () => {
    const [courses, sessions, students, activeSession] = await Promise.all([
      backend.listCourses(),
      backend.listAcademicSessions(),
      backend.listStudents(),
      backend.getActiveAcademicSession(),
    ]);
    return { enrollments: null as unknown as Enrollment[], courses, sessions, students, activeSessionId: activeSession?.id ?? '' };
  }, []);

  const effectiveSession = sessionId || data?.activeSessionId || '';

  const { data: enrollments, loading: loadingEnrollments, reload: reloadEnrollments } = useAsync<Enrollment[]>(async () => {
    if (!effectiveSession) return [];
    if (courseFilter === 'all') return backend.listEnrollments({ academicSessionId: effectiveSession });
    return backend.listEnrollments({ courseId: courseFilter, academicSessionId: effectiveSession });
  }, [effectiveSession, courseFilter]);

  const courseMap = useMemo(() => new Map((data?.courses ?? []).map((c) => [c.id, c])), [data]);
  const filteredStudents = useMemo(() => {
    let rows = data?.students ?? [];
    if (studentSearch.trim()) {
      const q = studentSearch.trim().toLowerCase();
      rows = rows.filter((s) => (s.profile?.fullName ?? '').toLowerCase().includes(q) || s.studentNumber.toLowerCase().includes(q));
    }
    return rows;
  }, [data, studentSearch]);

  const openEnroll = () => {
    const firstCourse = courseFilter !== 'all' ? courseFilter : (data?.courses[0]?.id ?? '');
    setEnrollCourse(firstCourse);
    setSelected(new Set());
    setStudentSearch('');
    setEnrollOpen(true);
  };

  const toggleStudent = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doEnroll = async () => {
    if (!enrollCourse) {
      toast.error('Choose a course to enroll students into.');
      return;
    }
    if (selected.size === 0) {
      toast.error('Select at least one student.');
      return;
    }
    setEnrolling(true);
    let added = 0;
    let skipped = 0;
    let lastError = '';
    for (const studentId of selected) {
      try {
        await backend.createEnrollment({ courseId: enrollCourse, studentId, academicSessionId: effectiveSession });
        added += 1;
      } catch (err) {
        skipped += 1;
        lastError = errMessage(err);
      }
    }
    setEnrolling(false);
    setEnrollOpen(false);
    if (added > 0) toast.success(`${added} student${added === 1 ? '' : 's'} enrolled.`);
    if (skipped > 0) toast.error(`${skipped} skipped — ${lastError}`);
    await reloadEnrollments();
  };

  const doRemove = async () => {
    if (!confirmRemove) return;
    setBusy(true);
    try {
      await backend.deleteEnrollment(confirmRemove.id);
      toast.success('Enrollment removed.');
      setConfirmRemove(null);
      await reloadEnrollments();
    } catch (err) {
      toast.error(errMessage(err));
      setConfirmRemove(null);
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Enrollment>[] = [
    {
      header: 'Student',
      render: (e) => (
        <div>
          <p className="font-semibold text-slate-900">{e.student?.profile?.fullName ?? '—'}</p>
          <p className="font-mono text-xs text-slate-500">{e.student?.studentNumber}</p>
        </div>
      ),
    },
    {
      header: 'Course',
      render: (e) => (
        <div>
          <p className="font-semibold text-indigo-600">{e.course?.code}</p>
          <p className="text-xs text-slate-500">{e.course?.title}</p>
        </div>
      ),
    },
    { header: 'Level', className: 'text-center', render: (e) => e.student?.level ?? '—' },
    {
      header: 'Actions',
      className: 'text-right',
      render: (e) => (
        <button onClick={() => setConfirmRemove(e)} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-rose-600" title="Remove enrollment">
          <Trash2 className="h-4 w-4" />
        </button>
      ),
    },
  ];

  if (loading) return <div className="py-16 text-center text-sm text-slate-500">Loading enrollments…</div>;
  if (error) return <ErrorState message={errMessage(error)} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title="Enrollments"
        subtitle="Register students into courses for an academic session (doc §17)."
        action={
          <Button onClick={openEnroll} disabled={!effectiveSession || (data?.students.length ?? 0) === 0}>
            <UserPlus className="h-4 w-4" /> Enroll students
          </Button>
        }
      />

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <select
          className="block w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          aria-label="Filter by course"
        >
          <option value="all">All courses</option>
          {(data?.courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} — {c.title}
            </option>
          ))}
        </select>
        <select
          className="block w-full rounded-xl border-0 bg-white px-3 py-2.5 text-sm shadow-sm ring-1 ring-inset ring-slate-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600"
          value={effectiveSession}
          onChange={(e) => setSessionId(e.target.value)}
          aria-label="Academic session"
        >
          <option value="" disabled>
            Select session…
          </option>
          {(data?.sessions ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} {s.id === data?.activeSessionId ? '(active)' : ''}
            </option>
          ))}
        </select>
      </div>

      <Card>
        <DataTable
          columns={columns}
          rows={enrollments ?? []}
          keyOf={(e) => e.id}
          loadingNote={loadingEnrollments ? 'Loading enrollments…' : undefined}
          mobileCard={(e) => (
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{e.student?.profile?.fullName}</p>
                <p className="font-mono text-xs text-slate-500">{e.student?.studentNumber}</p>
                <p className="mt-0.5 text-xs text-indigo-600">{e.course?.code}</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => setConfirmRemove(e)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          empty={
            <EmptyState
              icon={<UserPlus className="h-7 w-7" />}
              title="No enrollments found"
              message={
                !effectiveSession
                  ? 'Create and activate an academic session first.'
                  : 'Use “Enroll students” to register students into a course for this session.'
              }
            />
          }
        />
      </Card>

      <Modal open={enrollOpen} onClose={() => setEnrollOpen(false)} title="Enroll students" wide>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select value={enrollCourse} onChange={(e) => { setEnrollCourse(e.target.value); setSelected(new Set()); }}>
              {(data?.courses ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </Select>
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600 ring-1 ring-inset ring-slate-200">
              <Badge tone="indigo">{(data?.sessions ?? []).find((s) => s.id === effectiveSession)?.name ?? '—'}</Badge>
              academic session
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <SearchInput value={studentSearch} onChange={setStudentSearch} placeholder="Search students…" />
          </div>

          <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl ring-1 ring-inset ring-slate-200">
            {filteredStudents.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">No students match.</p>
            ) : (
              filteredStudents.map((s) => {
                const checked = selected.has(s.id);
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => toggleStudent(s.id)}
                    className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition ${checked ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                  >
                    {checked ? <CheckSquare className="h-5 w-5 text-indigo-600" /> : <Square className="h-5 w-5 text-slate-300" />}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{s.profile?.fullName}</span>
                      <span className="block font-mono text-xs text-slate-500">
                        {s.studentNumber} · {s.department?.code} {s.level}L
                      </span>
                    </span>
                    {courseMap.get(enrollCourse) && s.level > (courseMap.get(enrollCourse)?.level ?? s.level) && (
                      <Badge tone="amber">Level mismatch</Badge>
                    )}
                  </button>
                );
              })
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <p className="mr-auto text-sm text-slate-500">{selected.size} selected</p>
            <Button variant="secondary" onClick={() => setEnrollOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doEnroll} loading={enrolling} disabled={selected.size === 0}>
              Enroll {selected.size > 0 ? `${selected.size} student${selected.size === 1 ? '' : 's'}` : ''}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmRemove)}
        title="Remove enrollment?"
        message={
          <>
            Remove <b>{confirmRemove?.student?.profile?.fullName}</b> from <b>{confirmRemove?.course?.code}</b>? Their
            attendance records for this course remain in the system.
          </>
        }
        loading={busy}
        onConfirm={doRemove}
        onCancel={() => setConfirmRemove(null)}
      />
    </>
  );
}
