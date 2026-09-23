import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { QrCode } from 'lucide-react';
import { Button, Field, Modal, Select } from './ui';
import { useToast } from './toast';
import { backend } from '../services';
import { errMessage } from '../lib/errors';
import type { Course } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  courses: Course[];
  lecturerId: string;
  academicSessionId: string;
  defaultCourseId?: string;
}

/** "Start Attendance" flow (doc §48): choose course → token duration → live QR page. */
export function StartSessionModal({ open, onClose, courses, lecturerId, academicSessionId, defaultCourseId }: Props) {
  const toast = useToast();
  const navigate = useNavigate();
  const [courseId, setCourseId] = useState(defaultCourseId ?? '');
  const [duration, setDuration] = useState('15');
  const [starting, setStarting] = useState(false);
  const effectiveCourse = courseId || defaultCourseId || courses[0]?.id || '';

  const start = async () => {
    if (!effectiveCourse) {
      toast.error('Select a course first.');
      return;
    }
    setStarting(true);
    try {
      const session = await backend.startAttendanceSession({
        courseId: effectiveCourse,
        lecturerId,
        academicSessionId,
        durationMinutes: Number(duration) || 15,
      });
      toast.success('Attendance session started — show the QR code to your class.');
      onClose();
      navigate(`/lecturer/attendance/${session.id}`);
    } catch (err) {
      toast.error(errMessage(err));
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Start attendance session">
      <div className="space-y-4">
        <p className="rounded-xl bg-indigo-50 px-3.5 py-2.5 text-sm text-indigo-700 ring-1 ring-inset ring-indigo-100">
          A temporary QR token will be generated. Students scan it to record their attendance; the token expires after
          the validity period you choose.
        </p>
        <Field label="Course" required>
          <Select value={effectiveCourse} onChange={(e) => setCourseId(e.target.value)}>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="QR validity (minutes)" required hint="Short windows reduce proxy attendance. You can refresh the code any time.">
          <Select value={duration} onChange={(e) => setDuration(e.target.value)}>
            {['5', '10', '15', '30', '60'].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={start} loading={starting}>
            <QrCode className="h-4 w-4" /> Start & generate QR
          </Button>
        </div>
      </div>
    </Modal>
  );
}
