import type {
  AttendanceRecord,
  AttendanceSession,
  Course,
  Enrollment,
  Student,
} from '../types';
import type {
  CourseStudentRow,
  LecturerCourseRow,
  SessionStats,
  StudentCourseRow,
} from './types';

// ── Shared aggregation logic ─────────────────────────────────────────────────
// Pure functions used by BOTH backends so mock mode and Supabase mode compute
// identical numbers (doc §32: percentage is always computed dynamically).

const HELD = (s: AttendanceSession) => s.status !== 'cancelled';

/** per-session stats: enrolled / present / late / absent */
export function computeSessionStatsMap(
  sessions: AttendanceSession[],
  records: AttendanceRecord[],
  enrollments: Enrollment[]
): Record<string, SessionStats> {
  const map: Record<string, SessionStats> = {};
  for (const s of sessions) {
    const enrolled = enrollments.filter(
      (e) => e.courseId === s.courseId && e.academicSessionId === s.academicSessionId
    ).length;
    map[s.id] = { enrolled, present: 0, late: 0, absent: 0 };
  }
  for (const r of records) {
    const st = map[r.attendanceSessionId];
    if (!st) continue;
    if (r.status === 'present') st.present += 1;
    else if (r.status === 'late') st.late += 1;
    else st.absent += 1;
  }
  return map;
}

export function rate(attended: number, held: number): number | null {
  if (held <= 0) return null;
  return (attended / held) * 100;
}

/** Report rows per student for one course (doc §31 course report). */
export function computeCourseStudentSummary(
  courseSessions: AttendanceSession[], // all sessions of the course
  records: AttendanceRecord[], // records belonging to those sessions (hydrated with studentId)
  students: Student[] // enrolled students
): CourseStudentRow[] {
  const held = courseSessions.filter(HELD);
  return students
    .slice()
    .sort((a, b) => (a.profile?.fullName ?? '').localeCompare(b.profile?.fullName ?? ''))
    .map((student) => {
      let present = 0;
      let late = 0;
      let absent = 0;
      for (const s of held) {
        const rec = records.find(
          (r) => r.attendanceSessionId === s.id && r.studentId === student.id
        );
        if (!rec) absent += 1;
        else if (rec.status === 'present') present += 1;
        else if (rec.status === 'late') late += 1;
        else absent += 1;
      }
      return {
        student,
        sessionsHeld: held.length,
        present,
        late,
        absent,
        percentage: rate(present + late, held.length),
      };
    });
}

/** Report rows per course for one student (doc §31 student report). */
export function computeStudentCourseSummary(
  courses: Course[], // courses the student is enrolled in
  allSessions: AttendanceSession[], // sessions of those courses
  studentRecords: AttendanceRecord[] // this student's records only
): StudentCourseRow[] {
  return courses.map((course) => {
    const held = allSessions.filter((s) => s.courseId === course.id && HELD(s));
    const heldIds = new Set(held.map((s) => s.id));
    const attended = studentRecords.filter(
      (r) => heldIds.has(r.attendanceSessionId) && (r.status === 'present' || r.status === 'late')
    ).length;
    return { course, sessionsHeld: held.length, attended, percentage: rate(attended, held.length) };
  });
}

/** Average attendance per course for one lecturer (doc §31 lecturer report). */
export function computeLecturerCourseSummary(
  courses: Course[],
  lecturerSessions: AttendanceSession[],
  records: AttendanceRecord[],
  enrollments: Enrollment[]
): LecturerCourseRow[] {
  return courses.map((course) => {
    const held = lecturerSessions.filter((s) => s.courseId === course.id && HELD(s));
    let attended = 0;
    let capacity = 0;
    for (const s of held) {
      const enrolled = enrollments.filter(
        (e) => e.courseId === s.courseId && e.academicSessionId === s.academicSessionId
      ).length;
      capacity += enrolled;
      attended += records.filter(
        (r) => r.attendanceSessionId === s.id && (r.status === 'present' || r.status === 'late')
      ).length;
    }
    return {
      course,
      sessionsHeld: held.length,
      enrolled:
        enrollments.filter((e) => e.courseId === course.id && e.academicSessionId === (held[0]?.academicSessionId ?? e.academicSessionId)).length,
      averageAttendance: rate(attended, capacity),
    };
  });
}

export function overallPercentage(rows: StudentCourseRow[]): number | null {
  const held = rows.reduce((acc, r) => acc + r.sessionsHeld, 0);
  const attended = rows.reduce((acc, r) => acc + r.attended, 0);
  return rate(attended, held);
}
