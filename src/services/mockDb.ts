import type {
  AcademicSession,
  AttendanceRecord,
  AttendanceSession,
  Course,
  Department,
  Enrollment,
  Lecturer,
  LecturerCourse,
  Profile,
  Student,
} from '../types';

// ── Demo database shape + seed data ──────────────────────────────────────────
// The mock backend persists this structure to localStorage and reloads it on
// every call, so changes survive refreshes and sync across browser tabs.

export const DB_KEY = 'smartattend.demo.db.v1';
export const SESSION_KEY = 'smartattend.demo.session';

export interface DemoCredential {
  profileId: string;
  email: string;
  password: string;
}

export interface DemoDB {
  profiles: Profile[];
  credentials: DemoCredential[];
  departments: Department[];
  students: Student[];
  lecturers: Lecturer[];
  courses: Course[];
  academicSessions: AcademicSession[];
  enrollments: Enrollment[];
  lecturerCourses: LecturerCourse[];
  attendanceSessions: AttendanceSession[];
  attendanceRecords: AttendanceRecord[];
}

export const DEMO_PASSWORD = 'demo1234';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
function dateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function isoOffset(days: number, hours = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(d.getHours() + hours);
  return d.toISOString();
}

/** Deterministic attendance outcome so percentages look realistic. */
function seedStatus(studentIdx: number, sessionIdx: number): 'present' | 'late' | 'absent' {
  const r = (studentIdx * 3 + sessionIdx) % 7;
  if (r === 2) return 'absent';
  if (r === 5) return 'late';
  return 'present';
}

export function seedDemoData(): DemoDB {
  const nowIso = new Date().toISOString();

  // Departments ──────────────────────────────────────────────────────────────
  const departments: Department[] = [
    { id: 'd-csc', name: 'Computer Science', code: 'CSC', createdAt: nowIso },
    { id: 'd-phy', name: 'Physics', code: 'PHY', createdAt: nowIso },
    { id: 'd-mth', name: 'Mathematics', code: 'MTH', createdAt: nowIso },
  ];

  // Academic sessions ────────────────────────────────────────────────────────
  const academicSessions: AcademicSession[] = [
    { id: 's-2526', name: '2025/2026', startDate: dateOffset(-370), endDate: dateOffset(-50), isActive: false, createdAt: nowIso },
    { id: 's-2627', name: '2026/2027', startDate: dateOffset(-18), endDate: dateOffset(+300), isActive: true, createdAt: nowIso },
  ];

  // Profiles ─────────────────────────────────────────────────────────────────
  const profiles: Profile[] = [
    { id: 'p-admin', fullName: 'System Administrator', email: 'admin@smartattend.test', role: 'admin', phone: '+234 800 000 0001', avatarUrl: null, isActive: true, createdAt: nowIso },
    { id: 'p-l1', fullName: 'Dr. Funmi Adeyemi', email: 'lecturer@smartattend.test', role: 'lecturer', phone: '+234 800 000 0002', avatarUrl: null, isActive: true, createdAt: nowIso },
    { id: 'p-l2', fullName: 'Dr. Emeka Obi', email: 'emeka.obi@smartattend.test', role: 'lecturer', phone: '+234 800 000 0003', avatarUrl: null, isActive: true, createdAt: nowIso },
    { id: 'p-l3', fullName: 'Mrs. Aisha Yusuf', email: 'aisha.yusuf@smartattend.test', role: 'lecturer', phone: '+234 800 000 0004', avatarUrl: null, isActive: true, createdAt: nowIso },
  ];

  const studentNames: Array<[string, string, string, number]> = [
    // [fullName, studentNumber, departmentId, level]
    ['Chinedu Okafor', 'CSC/2022/0101', 'd-csc', 300],
    ['Ngozi Eze', 'CSC/2022/0102', 'd-csc', 300],
    ['Tunde Balogun', 'CSC/2022/0103', 'd-csc', 300],
    ['Fatima Sani', 'CSC/2022/0104', 'd-csc', 300],
    ['Chukwuemeka Nwosu', 'CSC/2022/0105', 'd-csc', 300],
    ['Blessing Okoro', 'CSC/2022/0106', 'd-csc', 300],
    ['Yusuf Abubakar', 'PHY/2023/0211', 'd-phy', 200],
    ['Chioma Okeke', 'PHY/2023/0212', 'd-phy', 200],
    ['Segun Adebayo', 'PHY/2023/0213', 'd-phy', 200],
    ['Amina Mohammed', 'MTH/2024/0321', 'd-mth', 100],
    ['Kelechi Umeh', 'MTH/2024/0322', 'd-mth', 100],
    ['Grace Ekanem', 'MTH/2024/0323', 'd-mth', 100],
  ];

  studentNames.forEach(([fullName, studentNumber], i) => {
    const id = `p-s${i + 1}`;
    const slug = fullName.toLowerCase().replace(/[^a-z]+/g, '.');
    profiles.push({
      id,
      fullName,
      email: `${slug}@smartattend.test`,
      role: 'student',
      phone: `+234 801 000 00${pad(i + 10)}`,
      avatarUrl: null,
      isActive: true,
      createdAt: nowIso,
    });
  });

  const credentials: DemoCredential[] = profiles.map((p) => ({
    profileId: p.id,
    email: p.email,
    password: DEMO_PASSWORD,
  }));
  // Friendly demo aliases (shown on the login page quick-fill buttons)
  credentials.push(
    { profileId: 'p-admin', email: 'admin@smartattend.test', password: DEMO_PASSWORD },
    { profileId: 'p-l1', email: 'lecturer@smartattend.test', password: DEMO_PASSWORD },
    { profileId: 'p-s1', email: 'student@smartattend.test', password: DEMO_PASSWORD }
  );

  // Lecturers ────────────────────────────────────────────────────────────────
  const lecturers: Lecturer[] = [
    { id: 'l-1', profileId: 'p-l1', staffNumber: 'LC/001', departmentId: 'd-csc', isActive: true, createdAt: nowIso },
    { id: 'l-2', profileId: 'p-l2', staffNumber: 'LC/002', departmentId: 'd-phy', isActive: true, createdAt: nowIso },
    { id: 'l-3', profileId: 'p-l3', staffNumber: 'LC/003', departmentId: 'd-mth', isActive: true, createdAt: nowIso },
  ];

  // Students ─────────────────────────────────────────────────────────────────
  const students: Student[] = studentNames.map(([fullName, studentNumber, departmentId, level], i) => ({
    id: `stu-${i + 1}`,
    profileId: `p-s${i + 1}`,
    studentNumber,
    departmentId,
    level,
    isActive: true,
    createdAt: nowIso,
  }));

  // Courses ──────────────────────────────────────────────────────────────────
  const courses: Course[] = [
    { id: 'c-csc301', code: 'CSC301', title: 'Database Systems', departmentId: 'd-csc', level: 300, creditUnit: 3, createdAt: nowIso },
    { id: 'c-csc302', code: 'CSC302', title: 'Operating Systems', departmentId: 'd-csc', level: 300, creditUnit: 3, createdAt: nowIso },
    { id: 'c-csc305', code: 'CSC305', title: 'Web Technologies', departmentId: 'd-csc', level: 300, creditUnit: 3, createdAt: nowIso },
    { id: 'c-phy202', code: 'PHY202', title: 'Electromagnetism', departmentId: 'd-phy', level: 200, creditUnit: 3, createdAt: nowIso },
    { id: 'c-mth101', code: 'MTH101', title: 'Elementary Mathematics I', departmentId: 'd-mth', level: 100, creditUnit: 3, createdAt: nowIso },
  ];

  // Lecturer → course assignments ────────────────────────────────────────────
  const lecturerCourses: LecturerCourse[] = [
    { id: 'lc-1', lecturerId: 'l-1', courseId: 'c-csc301', academicSessionId: 's-2627', createdAt: nowIso },
    { id: 'lc-2', lecturerId: 'l-1', courseId: 'c-csc302', academicSessionId: 's-2627', createdAt: nowIso },
    { id: 'lc-3', lecturerId: 'l-1', courseId: 'c-csc305', academicSessionId: 's-2627', createdAt: nowIso },
    { id: 'lc-4', lecturerId: 'l-2', courseId: 'c-phy202', academicSessionId: 's-2627', createdAt: nowIso },
    { id: 'lc-5', lecturerId: 'l-3', courseId: 'c-mth101', academicSessionId: 's-2627', createdAt: nowIso },
  ];

  // Enrollments ──────────────────────────────────────────────────────────────
  const enrollments: Enrollment[] = [];
  const cscStudents = students.slice(0, 6);
  const phyStudents = students.slice(6, 9);
  const mthStudents = students.slice(9, 12);
  const pushEnroll = (courseId: string, list: Student[]) =>
    list.forEach((s) =>
      enrollments.push({
        id: `e-${courseId}-${s.id}`,
        courseId,
        studentId: s.id,
        academicSessionId: 's-2627',
        createdAt: nowIso,
      })
    );
  ['c-csc301', 'c-csc302', 'c-csc305'].forEach((c) => pushEnroll(c, cscStudents));
  pushEnroll('c-phy202', phyStudents);
  pushEnroll('c-mth101', mthStudents);

  // Attendance history ───────────────────────────────────────────────────────
  const history: Array<{ courseId: string; lecturerId: string; offsets: number[] }> = [
    { courseId: 'c-csc301', lecturerId: 'l-1', offsets: [-14, -11, -9, -7, -4, -2] },
    { courseId: 'c-csc302', lecturerId: 'l-1', offsets: [-12, -8, -3] },
    { courseId: 'c-csc305', lecturerId: 'l-1', offsets: [-10, -1] },
    { courseId: 'c-phy202', lecturerId: 'l-2', offsets: [-13, -9, -6, -1] },
    { courseId: 'c-mth101', lecturerId: 'l-3', offsets: [-11, -4] },
  ];

  const attendanceSessions: AttendanceSession[] = [];
  const attendanceRecords: AttendanceRecord[] = [];
  let sessionCounter = 0;

  for (const h of history) {
    const enrolled = enrollments.filter((e) => e.courseId === h.courseId);
    h.offsets.forEach((offset, sessionIdx) => {
      sessionCounter += 1;
      const sessionId = `as-${h.courseId}-${sessionIdx + 1}`;
      attendanceSessions.push({
        id: sessionId,
        courseId: h.courseId,
        lecturerId: h.lecturerId,
        academicSessionId: 's-2627',
        sessionDate: dateOffset(offset),
        startTime: '10:00',
        endTime: '11:00',
        status: 'closed',
        qrToken: `SA-${h.courseId.toUpperCase()}-${sessionCounter}`,
        qrExpiresAt: isoOffset(offset, 1),
        createdAt: isoOffset(offset, -1),
      });
      enrolled.forEach((e, studentIdx) => {
        const status = seedStatus(studentIdx, sessionIdx);
        if (status === 'absent') return; // absentees simply have no record
        attendanceRecords.push({
          id: `r-${sessionId}-${e.studentId}`,
          attendanceSessionId: sessionId,
          studentId: e.studentId,
          markedAt: isoOffset(offset, 0),
          status,
          method: 'qr',
          createdAt: isoOffset(offset, 0),
        });
      });
    });
  }

  // One LIVE session right now so the demo flow is immediately scannable.
  const rightNow = new Date();
  const hhmm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  const inOneHour = new Date(rightNow.getTime() + 60 * 60 * 1000);
  const qrExpires = new Date();
  qrExpires.setHours(qrExpires.getHours() + 24); // generous for demo purposes
  attendanceSessions.push({
    id: 'as-csc301-live',
    courseId: 'c-csc301',
    lecturerId: 'l-1',
    academicSessionId: 's-2627',
    sessionDate: dateOffset(0),
    startTime: hhmm(rightNow),
    endTime: hhmm(inOneHour),
    status: 'active',
    qrToken: 'SMART-DEMO-LIVE',
    qrExpiresAt: qrExpires.toISOString(),
    createdAt: rightNow.toISOString(),
  });

  return {
    profiles,
    credentials,
    departments,
    students,
    lecturers,
    courses,
    academicSessions,
    enrollments,
    lecturerCourses,
    attendanceSessions,
    attendanceRecords,
  };
}
