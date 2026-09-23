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
  SessionStatus,
  Student,
} from '../types';
import { BackendError } from '../lib/errors';
import { todayISO } from '../lib/format';
import {
  computeCourseStudentSummary,
  computeLecturerCourseSummary,
  computeSessionStatsMap,
  computeStudentCourseSummary,
  overallPercentage,
  rate,
} from './aggregate';
import { DB_KEY, SESSION_KEY, seedDemoData, type DemoDB } from './mockDb';
import type {
  AcademicSessionInput,
  AdminStats,
  LecturerStats,
  StudentStats,
  AssignmentInput,
  AttendanceSessionWithStats,
  Backend,
  CourseInput,
  CourseStudentRow,
  DepartmentInput,
  EnrollmentInput,
  LecturerCourseRow,
  LecturerInput,
  RecordAttendanceResult,
  StartSessionInput,
  StudentCourseRow,
  StudentInput,
} from './types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

const randomToken = (): string => {
  let s = '';
  for (let i = 0; i < 10; i++) s += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)];
  return `SA-${s}`;
};

function load(): DemoDB {
  const raw = localStorage.getItem(DB_KEY);
  if (raw) {
    try {
      return JSON.parse(raw) as DemoDB;
    } catch {
      /* fall through and reseed */
    }
  }
  const db = seedDemoData();
  localStorage.setItem(DB_KEY, JSON.stringify(db));
  return db;
}

function save(db: DemoDB): void {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function hydrateStudent(db: DemoDB, s: Student): Student {
  return {
    ...s,
    profile: db.profiles.find((p) => p.id === s.profileId),
    department: db.departments.find((d) => d.id === s.departmentId),
  };
}

function hydrateCourse(db: DemoDB, c: Course): Course {
  return { ...c, department: db.departments.find((d) => d.id === c.departmentId) };
}

function hydrateLecturer(db: DemoDB, l: Lecturer): Lecturer {
  return {
    ...l,
    profile: db.profiles.find((p) => p.id === l.profileId),
    department: db.departments.find((d) => d.id === l.departmentId),
  };
}

function hydrateEnrollment(db: DemoDB, e: Enrollment): Enrollment {
  const student = db.students.find((s) => s.id === e.studentId);
  return {
    ...e,
    student: student ? hydrateStudent(db, student) : undefined,
    course: db.courses.find((c) => c.id === e.courseId),
    academicSession: db.academicSessions.find((s) => s.id === e.academicSessionId),
  };
}

function hydrateAssignment(db: DemoDB, lc: LecturerCourse): LecturerCourse {
  const lecturer = db.lecturers.find((l) => l.id === lc.lecturerId);
  return {
    ...lc,
    lecturer: lecturer ? hydrateLecturer(db, lecturer) : undefined,
    course: db.courses.find((c) => c.id === lc.courseId),
    academicSession: db.academicSessions.find((s) => s.id === lc.academicSessionId),
  };
}

function withStats(
  db: DemoDB,
  sessions: AttendanceSession[],
  opts: { hydrateLecturer?: boolean } = {}
): AttendanceSessionWithStats[] {
  const ids = new Set(sessions.map((s) => s.id));
  const records = db.attendanceRecords.filter((r) => ids.has(r.attendanceSessionId));
  const statsMap = computeSessionStatsMap(sessions, records, db.enrollments);
  return sessions
    .map((s) => {
      const stats = statsMap[s.id] ?? { enrolled: 0, present: 0, late: 0, absent: 0 };
      const attended = stats.present + stats.late;
      return {
        ...s,
        course: db.courses.find((c) => c.id === s.courseId),
        lecturer: opts.hydrateLecturer
          ? (() => {
              const l = db.lecturers.find((x) => x.id === s.lecturerId);
              return l ? hydrateLecturer(db, l) : undefined;
            })()
          : undefined,
        stats,
        rate: rate(attended, stats.enrolled),
      };
    })
    .sort((a, b) => (b.sessionDate + b.startTime).localeCompare(a.sessionDate + a.startTime));
}

function currentProfileFrom(db: DemoDB): Profile | null {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) return null;
  return db.profiles.find((p) => p.id === id) ?? null;
}

function requireProfile(db: DemoDB): Profile {
  const p = currentProfileFrom(db);
  if (!p) throw new BackendError('unauthenticated', 'Your session has ended. Please sign in again.');
  return p;
}

function requireAdmin(db: DemoDB): Profile {
  const p = requireProfile(db);
  if (p.role !== 'admin') throw new BackendError('permission', 'Only administrators can perform this action.');
  return p;
}

/** Simulation of server-side checks used by markAttendanceManual(). */
function checkManualEligible(db: DemoDB, sessionId: string, studentId: string): void {
  if (!db.attendanceSessions.some((s) => s.id === sessionId))
    throw new BackendError('not_found', 'Attendance session not found.');
  if (!db.students.some((s) => s.id === studentId))
    throw new BackendError('not_found', 'Student not found.');
  if (db.attendanceRecords.some((r) => r.attendanceSessionId === sessionId && r.studentId === studentId))
    throw new BackendError('already_marked', 'This student already has an attendance record for this session.');
}

// ── The mock backend ─────────────────────────────────────────────────────────

export class MockBackend implements Backend {
  readonly mode = 'mock' as const;

  // ── Auth ───────────────────────────────────────────────────────────────────

  async signIn(email: string, password: string): Promise<Profile> {
    const db = load();
    const cred = db.credentials.find((c) => c.email.toLowerCase() === email.trim().toLowerCase());
    if (!cred || cred.password !== password)
      throw new BackendError('invalid_credentials', 'Incorrect email or password.');
    const profile = db.profiles.find((p) => p.id === cred.profileId);
    if (!profile || !profile.isActive)
      throw new BackendError('account_inactive', 'This account has been deactivated. Contact the administrator.');
    localStorage.setItem(SESSION_KEY, profile.id);
    return profile;
  }

  async signOut(): Promise<void> {
    localStorage.removeItem(SESSION_KEY);
  }

  async getCurrentProfile(): Promise<Profile | null> {
    return currentProfileFrom(load());
  }

  async resetPassword(_email: string): Promise<void> {
    // Demo mode: nothing to send. The UI explains this.
    return;
  }

  async changePassword(newPassword: string): Promise<void> {
    const db = load();
    const profile = requireProfile(db);
    const cred = db.credentials.find((c) => c.profileId === profile.id);
    if (!cred) throw new BackendError('not_found', 'Demo account not found.');
    cred.password = newPassword;
    save(db);
  }

  async updateOwnProfile(input: { fullName?: string; phone?: string }): Promise<Profile> {
    const db = load();
    const profile = requireProfile(db);
    const p = db.profiles.find((x) => x.id === profile.id)!;
    if (input.fullName !== undefined) p.fullName = input.fullName;
    if (input.phone !== undefined) p.phone = input.phone;
    save(db);
    return { ...p };
  }

  // ── Academic sessions ──────────────────────────────────────────────────────

  async getActiveAcademicSession(): Promise<AcademicSession | null> {
    return load().academicSessions.find((s) => s.isActive) ?? null;
  }

  async listAcademicSessions(): Promise<AcademicSession[]> {
    return load()
      .academicSessions.slice()
      .sort((a, b) => b.name.localeCompare(a.name));
  }

  async createAcademicSession(input: AcademicSessionInput): Promise<AcademicSession> {
    const db = load();
    requireAdmin(db);
    const name = input.name.trim();
    if (!name || !input.startDate || !input.endDate)
      throw new BackendError('validation', 'Session name, start date and end date are required.');
    if (db.academicSessions.some((s) => s.name.toLowerCase() === name.toLowerCase()))
      throw new BackendError('duplicate', 'An academic session with this name already exists.');
    const session: AcademicSession = {
      id: uid(),
      name,
      startDate: input.startDate,
      endDate: input.endDate,
      isActive: false,
      createdAt: new Date().toISOString(),
    };
    db.academicSessions.push(session);
    save(db);
    return session;
  }

  async updateAcademicSession(id: string, input: Partial<AcademicSessionInput>): Promise<void> {
    const db = load();
    requireAdmin(db);
    const s = db.academicSessions.find((x) => x.id === id);
    if (!s) throw new BackendError('not_found', 'Academic session not found.');
    Object.assign(s, input);
    save(db);
  }

  async activateAcademicSession(id: string): Promise<void> {
    const db = load();
    requireAdmin(db);
    if (!db.academicSessions.some((s) => s.id === id))
      throw new BackendError('not_found', 'Academic session not found.');
    for (const s of db.academicSessions) s.isActive = s.id === id;
    save(db);
  }

  async deleteAcademicSession(id: string): Promise<void> {
    const db = load();
    requireAdmin(db);
    const s = db.academicSessions.find((x) => x.id === id);
    if (!s) return;
    if (s.isActive) throw new BackendError('validation', 'Deactivate this session before deleting it.');
    db.enrollments = db.enrollments.filter((e) => e.academicSessionId !== id);
    db.lecturerCourses = db.lecturerCourses.filter((lc) => lc.academicSessionId !== id);
    db.academicSessions = db.academicSessions.filter((x) => x.id !== id);
    save(db);
  }

  // ── Departments ────────────────────────────────────────────────────────────

  async listDepartments(): Promise<Department[]> {
    return load()
      .departments.slice()
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async createDepartment(input: DepartmentInput): Promise<Department> {
    const db = load();
    requireAdmin(db);
    const name = input.name.trim();
    const code = input.code.trim().toUpperCase();
    if (!name || !code) throw new BackendError('validation', 'Department name and code are required.');
    if (db.departments.some((d) => d.code === code))
      throw new BackendError('duplicate', 'A department with this code already exists.');
    if (db.departments.some((d) => d.name.toLowerCase() === name.toLowerCase()))
      throw new BackendError('duplicate', 'A department with this name already exists.');
    const dept: Department = { id: uid(), name, code, createdAt: new Date().toISOString() };
    db.departments.push(dept);
    save(db);
    return dept;
  }

  async updateDepartment(id: string, input: DepartmentInput): Promise<void> {
    const db = load();
    requireAdmin(db);
    const dept = db.departments.find((d) => d.id === id);
    if (!dept) throw new BackendError('not_found', 'Department not found.');
    const name = input.name.trim();
    const code = input.code.trim().toUpperCase();
    if (db.departments.some((d) => d.id !== id && d.code === code))
      throw new BackendError('duplicate', 'A department with this code already exists.');
    dept.name = name;
    dept.code = code;
    save(db);
  }

  async deleteDepartment(id: string): Promise<void> {
    const db = load();
    requireAdmin(db);
    const used =
      db.students.some((s) => s.departmentId === id) ||
      db.lecturers.some((l) => l.departmentId === id) ||
      db.courses.some((c) => c.departmentId === id);
    if (used)
      throw new BackendError('validation', 'This department still has students, lecturers or courses attached to it.');
    db.departments = db.departments.filter((d) => d.id !== id);
    save(db);
  }

  // ── Students ───────────────────────────────────────────────────────────────

  async listStudents(opts?: { search?: string; departmentId?: string }): Promise<Student[]> {
    const db = load();
    let rows = db.students.map((s) => hydrateStudent(db, s));
    if (opts?.departmentId) rows = rows.filter((s) => s.departmentId === opts.departmentId);
    if (opts?.search) {
      const q = opts.search.trim().toLowerCase();
      rows = rows.filter(
        (s) =>
          (s.profile?.fullName ?? '').toLowerCase().includes(q) ||
          s.studentNumber.toLowerCase().includes(q)
      );
    }
    return rows.sort((a, b) => (a.profile?.fullName ?? '').localeCompare(b.profile?.fullName ?? ''));
  }

  async createStudent(input: StudentInput): Promise<Student> {
    const db = load();
    requireAdmin(db);
    const email = input.email.trim().toLowerCase();
    const studentNumber = input.studentNumber.trim().toUpperCase();
    if (!input.fullName.trim() || !email || !studentNumber)
      throw new BackendError('validation', 'Full name, email and student number are required.');
    if (db.profiles.some((p) => p.email.toLowerCase() === email))
      throw new BackendError('duplicate_email', 'A user with this email already exists.');
    if (db.students.some((s) => s.studentNumber === studentNumber))
      throw new BackendError('duplicate', 'A student with this matriculation number already exists.');
    const profileId = uid();
    db.profiles.push({
      id: profileId,
      fullName: input.fullName.trim(),
      email,
      role: 'student',
      phone: input.phone?.trim() || null,
      avatarUrl: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    db.credentials.push({ profileId, email, password: input.password?.trim() || 'demo1234' });
    const student: Student = {
      id: uid(),
      profileId,
      studentNumber,
      departmentId: input.departmentId,
      level: input.level,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    db.students.push(student);
    save(db);
    return hydrateStudent(db, student);
  }

  async updateStudent(id: string, input: Partial<StudentInput> & { isActive?: boolean }): Promise<void> {
    const db = load();
    requireAdmin(db);
    const student = db.students.find((s) => s.id === id);
    if (!student) throw new BackendError('not_found', 'Student not found.');
    const profile = db.profiles.find((p) => p.id === student.profileId);
    if (input.studentNumber !== undefined) {
      const num = input.studentNumber.trim().toUpperCase();
      if (db.students.some((s) => s.id !== id && s.studentNumber === num))
        throw new BackendError('duplicate', 'A student with this matriculation number already exists.');
      student.studentNumber = num;
    }
    if (input.departmentId !== undefined) student.departmentId = input.departmentId;
    if (input.level !== undefined) student.level = input.level;
    if (input.isActive !== undefined) {
      student.isActive = input.isActive;
      if (profile) profile.isActive = input.isActive;
    }
    if (profile) {
      if (input.fullName !== undefined) profile.fullName = input.fullName.trim();
      if (input.phone !== undefined) profile.phone = input.phone.trim() || null;
      if (input.email !== undefined) {
        const email = input.email.trim().toLowerCase();
        if (db.profiles.some((p) => p.id !== profile.id && p.email.toLowerCase() === email))
          throw new BackendError('duplicate_email', 'A user with this email already exists.');
        profile.email = email;
        const cred = db.credentials.find((c) => c.profileId === profile.id);
        if (cred) cred.email = email;
      }
    }
    save(db);
  }

  async deleteStudent(id: string): Promise<void> {
    const db = load();
    requireAdmin(db);
    const student = db.students.find((s) => s.id === id);
    if (!student) return;
    db.students = db.students.filter((s) => s.id !== id);
    db.profiles = db.profiles.filter((p) => p.id !== student.profileId);
    db.credentials = db.credentials.filter((c) => c.profileId !== student.profileId);
    db.enrollments = db.enrollments.filter((e) => e.studentId !== id);
    db.attendanceRecords = db.attendanceRecords.filter((r) => r.studentId !== id);
    save(db);
  }

  // ── Lecturers ──────────────────────────────────────────────────────────────

  async listLecturers(opts?: { search?: string }): Promise<Lecturer[]> {
    const db = load();
    let rows = db.lecturers.map((l) => hydrateLecturer(db, l));
    if (opts?.search) {
      const q = opts.search.trim().toLowerCase();
      rows = rows.filter(
        (l) =>
          (l.profile?.fullName ?? '').toLowerCase().includes(q) ||
          l.staffNumber.toLowerCase().includes(q)
      );
    }
    return rows.sort((a, b) => (a.profile?.fullName ?? '').localeCompare(b.profile?.fullName ?? ''));
  }

  async createLecturer(input: LecturerInput): Promise<Lecturer> {
    const db = load();
    requireAdmin(db);
    const email = input.email.trim().toLowerCase();
    const staffNumber = input.staffNumber.trim().toUpperCase();
    if (!input.fullName.trim() || !email || !staffNumber)
      throw new BackendError('validation', 'Full name, email and staff number are required.');
    if (db.profiles.some((p) => p.email.toLowerCase() === email))
      throw new BackendError('duplicate_email', 'A user with this email already exists.');
    if (db.lecturers.some((l) => l.staffNumber === staffNumber))
      throw new BackendError('duplicate', 'A lecturer with this staff number already exists.');
    const profileId = uid();
    db.profiles.push({
      id: profileId,
      fullName: input.fullName.trim(),
      email,
      role: 'lecturer',
      phone: input.phone?.trim() || null,
      avatarUrl: null,
      isActive: true,
      createdAt: new Date().toISOString(),
    });
    db.credentials.push({ profileId, email, password: input.password?.trim() || 'demo1234' });
    const lecturer: Lecturer = {
      id: uid(),
      profileId,
      staffNumber,
      departmentId: input.departmentId,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    db.lecturers.push(lecturer);
    save(db);
    return hydrateLecturer(db, lecturer);
  }

  async updateLecturer(id: string, input: Partial<LecturerInput> & { isActive?: boolean }): Promise<void> {
    const db = load();
    requireAdmin(db);
    const lecturer = db.lecturers.find((l) => l.id === id);
    if (!lecturer) throw new BackendError('not_found', 'Lecturer not found.');
    const profile = db.profiles.find((p) => p.id === lecturer.profileId);
    if (input.staffNumber !== undefined) {
      const num = input.staffNumber.trim().toUpperCase();
      if (db.lecturers.some((l) => l.id !== id && l.staffNumber === num))
        throw new BackendError('duplicate', 'A lecturer with this staff number already exists.');
      lecturer.staffNumber = num;
    }
    if (input.departmentId !== undefined) lecturer.departmentId = input.departmentId;
    if (input.isActive !== undefined) {
      lecturer.isActive = input.isActive;
      if (profile) profile.isActive = input.isActive;
    }
    if (profile) {
      if (input.fullName !== undefined) profile.fullName = input.fullName.trim();
      if (input.phone !== undefined) profile.phone = input.phone.trim() || null;
      if (input.email !== undefined) {
        const email = input.email.trim().toLowerCase();
        if (db.profiles.some((p) => p.id !== profile.id && p.email.toLowerCase() === email))
          throw new BackendError('duplicate_email', 'A user with this email already exists.');
        profile.email = email;
        const cred = db.credentials.find((c) => c.profileId === profile.id);
        if (cred) cred.email = email;
      }
    }
    save(db);
  }

  async deleteLecturer(id: string): Promise<void> {
    const db = load();
    requireAdmin(db);
    const lecturer = db.lecturers.find((l) => l.id === id);
    if (!lecturer) return;
    db.lecturers = db.lecturers.filter((l) => l.id !== id);
    db.profiles = db.profiles.filter((p) => p.id !== lecturer.profileId);
    db.credentials = db.credentials.filter((c) => c.profileId !== lecturer.profileId);
    db.lecturerCourses = db.lecturerCourses.filter((lc) => lc.lecturerId !== id);
    save(db);
  }

  // ── Courses ────────────────────────────────────────────────────────────────

  async listCourses(opts?: { search?: string; departmentId?: string }): Promise<Course[]> {
    const db = load();
    let rows = db.courses.map((c) => hydrateCourse(db, c));
    if (opts?.departmentId) rows = rows.filter((c) => c.departmentId === opts.departmentId);
    if (opts?.search) {
      const q = opts.search.trim().toLowerCase();
      rows = rows.filter(
        (c) => c.code.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)
      );
    }
    return rows.sort((a, b) => a.code.localeCompare(b.code));
  }

  async createCourse(input: CourseInput): Promise<Course> {
    const db = load();
    requireAdmin(db);
    const code = input.code.trim().toUpperCase();
    if (!code || !input.title.trim())
      throw new BackendError('validation', 'Course code and title are required.');
    if (db.courses.some((c) => c.code === code))
      throw new BackendError('duplicate', 'A course with this code already exists.');
    const course: Course = {
      id: uid(),
      code,
      title: input.title.trim(),
      departmentId: input.departmentId,
      level: input.level,
      creditUnit: input.creditUnit,
      createdAt: new Date().toISOString(),
    };
    db.courses.push(course);
    save(db);
    return hydrateCourse(db, course);
  }

  async updateCourse(id: string, input: CourseInput): Promise<void> {
    const db = load();
    requireAdmin(db);
    const course = db.courses.find((c) => c.id === id);
    if (!course) throw new BackendError('not_found', 'Course not found.');
    const code = input.code.trim().toUpperCase();
    if (db.courses.some((c) => c.id !== id && c.code === code))
      throw new BackendError('duplicate', 'A course with this code already exists.');
    course.code = code;
    course.title = input.title.trim();
    course.departmentId = input.departmentId;
    course.level = input.level;
    course.creditUnit = input.creditUnit;
    save(db);
  }

  async deleteCourse(id: string): Promise<void> {
    const db = load();
    requireAdmin(db);
    const sessionIds = db.attendanceSessions.filter((s) => s.courseId === id).map((s) => s.id);
    db.courses = db.courses.filter((c) => c.id !== id);
    db.enrollments = db.enrollments.filter((e) => e.courseId !== id);
    db.lecturerCourses = db.lecturerCourses.filter((lc) => lc.courseId !== id);
    db.attendanceRecords = db.attendanceRecords.filter((r) => !sessionIds.includes(r.attendanceSessionId));
    db.attendanceSessions = db.attendanceSessions.filter((s) => s.courseId !== id);
    save(db);
  }

  // ── Enrollments ────────────────────────────────────────────────────────────

  async listEnrollments(opts?: { courseId?: string; studentId?: string; academicSessionId?: string }): Promise<Enrollment[]> {
    const db = load();
    let rows = db.enrollments.filter(
      (e) =>
        (!opts?.courseId || e.courseId === opts.courseId) &&
        (!opts?.studentId || e.studentId === opts.studentId) &&
        (!opts?.academicSessionId || e.academicSessionId === opts.academicSessionId)
    );
    rows = rows.map((e) => hydrateEnrollment(db, e));
    return rows.sort(
      (a, b) => (a.student?.profile?.fullName ?? '').localeCompare(b.student?.profile?.fullName ?? '')
    );
  }

  async createEnrollment(input: EnrollmentInput): Promise<Enrollment> {
    const db = load();
    requireAdmin(db);
    if (!db.courses.some((c) => c.id === input.courseId))
      throw new BackendError('not_found', 'Course not found.');
    if (!db.students.some((s) => s.id === input.studentId))
      throw new BackendError('not_found', 'Student not found.');
    if (!db.academicSessions.some((s) => s.id === input.academicSessionId))
      throw new BackendError('not_found', 'Academic session not found.');
    const exists = db.enrollments.some(
      (e) =>
        e.courseId === input.courseId &&
        e.studentId === input.studentId &&
        e.academicSessionId === input.academicSessionId
    );
    if (exists)
      throw new BackendError('duplicate', 'This student has already been enrolled in this course for this session.');
    const enrollment: Enrollment = { id: uid(), ...input, createdAt: new Date().toISOString() };
    db.enrollments.push(enrollment);
    save(db);
    return hydrateEnrollment(db, enrollment);
  }

  async deleteEnrollment(id: string): Promise<void> {
    const db = load();
    requireAdmin(db);
    db.enrollments = db.enrollments.filter((e) => e.id !== id);
    save(db);
  }

  // ── Lecturer → course assignments ──────────────────────────────────────────

  async listAssignments(opts?: { lecturerId?: string; courseId?: string; academicSessionId?: string }): Promise<LecturerCourse[]> {
    const db = load();
    let rows = db.lecturerCourses.filter(
      (lc) =>
        (!opts?.lecturerId || lc.lecturerId === opts.lecturerId) &&
        (!opts?.courseId || lc.courseId === opts.courseId) &&
        (!opts?.academicSessionId || lc.academicSessionId === opts.academicSessionId)
    );
    rows = rows.map((lc) => hydrateAssignment(db, lc));
    return rows.sort((a, b) => (a.course?.code ?? '').localeCompare(b.course?.code ?? ''));
  }

  async createAssignment(input: AssignmentInput): Promise<LecturerCourse> {
    const db = load();
    requireAdmin(db);
    if (!db.lecturers.some((l) => l.id === input.lecturerId))
      throw new BackendError('not_found', 'Lecturer not found.');
    if (!db.courses.some((c) => c.id === input.courseId))
      throw new BackendError('not_found', 'Course not found.');
    const exists = db.lecturerCourses.some(
      (lc) =>
        lc.lecturerId === input.lecturerId &&
        lc.courseId === input.courseId &&
        lc.academicSessionId === input.academicSessionId
    );
    if (exists)
      throw new BackendError('duplicate', 'This course is already assigned to this lecturer for this session.');
    const lc: LecturerCourse = { id: uid(), ...input, createdAt: new Date().toISOString() };
    db.lecturerCourses.push(lc);
    save(db);
    return hydrateAssignment(db, lc);
  }

  async deleteAssignment(id: string): Promise<void> {
    const db = load();
    requireAdmin(db);
    db.lecturerCourses = db.lecturerCourses.filter((lc) => lc.id !== id);
    save(db);
  }

  // ── Attendance sessions ────────────────────────────────────────────────────

  async listAttendanceSessions(opts?: { lecturerId?: string; courseId?: string; status?: SessionStatus }): Promise<AttendanceSessionWithStats[]> {
    const db = load();
    const rows = db.attendanceSessions.filter(
      (s) =>
        (!opts?.lecturerId || s.lecturerId === opts.lecturerId) &&
        (!opts?.courseId || s.courseId === opts.courseId) &&
        (!opts?.status || s.status === opts.status)
    );
    return withStats(db, rows, { hydrateLecturer: true });
  }

  async getAttendanceSession(id: string): Promise<AttendanceSessionWithStats> {
    const db = load();
    const row = db.attendanceSessions.find((s) => s.id === id);
    if (!row) throw new BackendError('not_found', 'Attendance session not found.');
    return withStats(db, [row], { hydrateLecturer: true })[0]!;
  }

  async startAttendanceSession(input: StartSessionInput): Promise<AttendanceSessionWithStats> {
    const db = load();
    const profile = requireProfile(db);
    if (profile.role !== 'lecturer' && profile.role !== 'admin')
      throw new BackendError('permission', 'Only lecturers can start attendance sessions.');
    const course = db.courses.find((c) => c.id === input.courseId);
    if (!course) throw new BackendError('not_found', 'Course not found.');
    if (!db.lecturerCourses.some((lc) => lc.courseId === input.courseId && lc.lecturerId === input.lecturerId))
      throw new BackendError('permission', 'This course is not assigned to you for this session.');
    const open = db.attendanceSessions.find(
      (s) => s.courseId === input.courseId && s.academicSessionId === input.academicSessionId && s.status === 'active'
    );
    if (open)
      throw new BackendError('validation', `Attendance for ${course.code} is already open. Close it before starting a new session.`);
    const duration = Math.max(1, Math.min(240, input.durationMinutes || 15));
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + duration);
    const session: AttendanceSession = {
      id: uid(),
      courseId: input.courseId,
      lecturerId: input.lecturerId,
      academicSessionId: input.academicSessionId,
      sessionDate: todayISO(),
      startTime: nowTime(),
      endTime: nowTime(),
      status: 'active',
      qrToken: randomToken(),
      qrExpiresAt: expires.toISOString(),
      createdAt: new Date().toISOString(),
    };
    db.attendanceSessions.push(session);
    save(db);
    return withStats(db, [session], { hydrateLecturer: true })[0]!;
  }

  async regenerateSessionToken(id: string, durationMinutes: number): Promise<AttendanceSessionWithStats> {
    const db = load();
    const session = db.attendanceSessions.find((s) => s.id === id);
    if (!session) throw new BackendError('not_found', 'Attendance session not found.');
    if (session.status === 'cancelled')
      throw new BackendError('validation', 'This session was cancelled and cannot be reopened.');
    const duration = Math.max(1, Math.min(240, durationMinutes || 15));
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + duration);
    session.qrToken = randomToken();
    session.qrExpiresAt = expires.toISOString();
    session.status = 'active';
    save(db);
    return withStats(db, [session], { hydrateLecturer: true })[0]!;
  }

  async setSessionStatus(id: string, status: SessionStatus): Promise<void> {
    const db = load();
    const session = db.attendanceSessions.find((s) => s.id === id);
    if (!session) throw new BackendError('not_found', 'Attendance session not found.');
    session.status = status;
    save(db);
  }

  // ── Attendance records ─────────────────────────────────────────────────────

  async listAttendanceRecords(opts: { sessionId?: string; studentId?: string; courseId?: string }): Promise<AttendanceRecord[]> {
    const db = load();
    let sessionIds: string[] | null = null;
    if (opts.courseId) {
      sessionIds = db.attendanceSessions.filter((s) => s.courseId === opts.courseId).map((s) => s.id);
    }
    const rows = db.attendanceRecords.filter((r) => {
      if (opts.sessionId && r.attendanceSessionId !== opts.sessionId) return false;
      if (opts.studentId && r.studentId !== opts.studentId) return false;
      if (sessionIds && !sessionIds.includes(r.attendanceSessionId)) return false;
      return true;
    });
    return rows
      .map((r) => {
        const session = db.attendanceSessions.find((s) => s.id === r.attendanceSessionId);
        const student = db.students.find((s) => s.id === r.studentId);
        return {
          ...r,
          session: session
            ? { ...session, course: db.courses.find((c) => c.id === session.courseId) }
            : undefined,
          student: student ? hydrateStudent(db, student) : undefined,
        };
      })
      .sort((a, b) => b.markedAt.localeCompare(a.markedAt));
  }

  async markAttendanceManual(sessionId: string, studentId: string, status: 'present' | 'late' = 'present'): Promise<void> {
    const db = load();
    requireProfile(db);
    checkManualEligible(db, sessionId, studentId);
    db.attendanceRecords.push({
      id: uid(),
      attendanceSessionId: sessionId,
      studentId,
      markedAt: new Date().toISOString(),
      status,
      method: 'manual',
      createdAt: new Date().toISOString(),
    });
    save(db);
  }

  async deleteAttendanceRecord(id: string): Promise<void> {
    const db = load();
    requireProfile(db);
    db.attendanceRecords = db.attendanceRecords.filter((r) => r.id !== id);
    save(db);
  }

  /**
   * The student-facing validation pipeline (doc §29). Every rule is enforced
   * here exactly as the Supabase `record_attendance()` function does.
   */
  async recordAttendanceByToken(token: string): Promise<RecordAttendanceResult> {
    const db = load();
    const profile = requireProfile(db);
    if (profile.role !== 'student')
      throw new BackendError('not_student', 'Only students can mark attendance.');
    const student = db.students.find((s) => s.profileId === profile.id);
    if (!student) throw new BackendError('not_student', 'No student record is linked to your account.');
    if (!student.isActive)
      throw new BackendError('account_inactive', 'Your student account is inactive. Contact the administrator.');

    const clean = token.trim();
    if (!clean) throw new BackendError('token_invalid', 'Enter the attendance code shown by your lecturer.');
    const session = db.attendanceSessions.find((s) => s.qrToken.toLowerCase() === clean.toLowerCase());
    if (!session)
      throw new BackendError('token_invalid', 'Invalid attendance code. Scan the QR code shown by your lecturer.');
    if (session.status !== 'active')
      throw new BackendError('session_closed', 'This attendance session is no longer open.');
    if (new Date(session.qrExpiresAt).getTime() < Date.now())
      throw new BackendError('token_expired', 'This QR code has expired. Ask your lecturer to refresh it.');

    const enrolled = db.enrollments.some(
      (e) =>
        e.studentId === student.id &&
        e.courseId === session.courseId &&
        e.academicSessionId === session.academicSessionId
    );
    if (!enrolled)
      throw new BackendError(
        'not_enrolled',
        `You are not registered for ${db.courses.find((c) => c.id === session.courseId)?.code ?? 'this course'} this session.`
      );
    if (db.attendanceRecords.some((r) => r.attendanceSessionId === session.id && r.studentId === student.id))
      throw new BackendError('already_marked', 'You have already marked attendance for this session.');

    // Late if more than 10 minutes after the session start time.
    const start = new Date(`${session.sessionDate}T${session.startTime}:00`);
    const isLate = Date.now() > start.getTime() + 10 * 60 * 1000;
    const status = isLate ? 'late' : 'present';
    const markedAt = new Date().toISOString();
    db.attendanceRecords.push({
      id: uid(),
      attendanceSessionId: session.id,
      studentId: student.id,
      markedAt,
      status,
      method: 'qr',
      createdAt: markedAt,
    });
    save(db);

    const course = db.courses.find((c) => c.id === session.courseId);
    return {
      sessionId: session.id,
      courseCode: course?.code ?? '',
      courseTitle: course?.title ?? '',
      sessionDate: session.sessionDate,
      markedAt,
      status,
    };
  }

  // ── Role resolvers ─────────────────────────────────────────────────────────

  async getStudentByProfile(profileId: string): Promise<Student | null> {
    const db = load();
    const s = db.students.find((x) => x.profileId === profileId);
    return s ? hydrateStudent(db, s) : null;
  }

  async getLecturerByProfile(profileId: string): Promise<Lecturer | null> {
    const db = load();
    const l = db.lecturers.find((x) => x.profileId === profileId);
    return l ? hydrateLecturer(db, l) : null;
  }

  // ── Summaries & reports ────────────────────────────────────────────────────

  async getCourseRoster(courseId: string, academicSessionId: string): Promise<Student[]> {
    const db = load();
    const ids = db.enrollments
      .filter((e) => e.courseId === courseId && e.academicSessionId === academicSessionId)
      .map((e) => e.studentId);
    return db.students
      .filter((s) => ids.includes(s.id))
      .map((s) => hydrateStudent(db, s))
      .sort((a, b) => (a.profile?.fullName ?? '').localeCompare(b.profile?.fullName ?? ''));
  }

  async getCourseAttendanceSummary(courseId: string): Promise<CourseStudentRow[]> {
    const db = load();
    const sessions = db.attendanceSessions.filter((s) => s.courseId === courseId);
    const sessionIds = new Set(sessions.map((s) => s.id));
    const sessionKeys = new Set(sessions.map((s) => `${s.courseId}:${s.academicSessionId}`));
    const students = db.students
      .filter((s) => db.enrollments.some((e) => e.studentId === s.id && sessionKeys.has(`${e.courseId}:${e.academicSessionId}`)))
      .map((s) => hydrateStudent(db, s));
    const records = db.attendanceRecords.filter((r) => sessionIds.has(r.attendanceSessionId));
    return computeCourseStudentSummary(sessions, records, students);
  }

  async getStudentCourseSummary(studentId: string, academicSessionId?: string): Promise<StudentCourseRow[]> {
    const db = load();
    const enrollments = db.enrollments.filter(
      (e) => e.studentId === studentId && (!academicSessionId || e.academicSessionId === academicSessionId)
    );
    const courses = enrollments
      .map((e) => db.courses.find((c) => c.id === e.courseId))
      .filter((c): c is Course => Boolean(c));
    const courseIds = new Set(courses.map((c) => c.id));
    const sessions = db.attendanceSessions.filter(
      (s) => courseIds.has(s.courseId) && (!academicSessionId || s.academicSessionId === academicSessionId)
    );
    const records = db.attendanceRecords.filter((r) => r.studentId === studentId);
    return computeStudentCourseSummary(courses, sessions, records);
  }

  async getLecturerCourseSummary(lecturerId: string, academicSessionId?: string): Promise<LecturerCourseRow[]> {
    const db = load();
    const assignments = db.lecturerCourses.filter(
      (lc) => lc.lecturerId === lecturerId && (!academicSessionId || lc.academicSessionId === academicSessionId)
    );
    const courses = assignments
      .map((a) => db.courses.find((c) => c.id === a.courseId))
      .filter((c): c is Course => Boolean(c));
    const sessions = db.attendanceSessions.filter(
      (s) => s.lecturerId === lecturerId && (!academicSessionId || s.academicSessionId === academicSessionId)
    );
    const sessionIds = new Set(sessions.map((s) => s.id));
    const records = db.attendanceRecords.filter((r) => sessionIds.has(r.attendanceSessionId));
    return computeLecturerCourseSummary(courses, sessions, records, db.enrollments);
  }

  // ── Dashboards ─────────────────────────────────────────────────────────────

  async getAdminStats(): Promise<AdminStats> {
    const db = load();
    const active = db.attendanceSessions.filter((s) => s.status === 'active');
    const today = db.attendanceSessions.filter((s) => s.sessionDate === todayISO() && s.status !== 'cancelled');
    let todayRate: number | null = null;
    if (today.length > 0) {
      const todayIds = new Set(today.map((s) => s.id));
      const records = db.attendanceRecords.filter((r) => todayIds.has(r.attendanceSessionId));
      const attended = records.filter((r) => r.status === 'present' || r.status === 'late').length;
      const statsMap = computeSessionStatsMap(today, records, db.enrollments);
      const capacity = today.reduce((acc, s) => acc + (statsMap[s.id]?.enrolled ?? 0), 0);
      todayRate = rate(attended, capacity);
    }
    return {
      students: db.students.length,
      lecturers: db.lecturers.length,
      courses: db.courses.length,
      departments: db.departments.length,
      activeSessions: active.length,
      todayRate,
    };
  }

  async getLecturerStats(lecturerId: string): Promise<LecturerStats> {
    const db = load();
    const activeSessionRow = db.attendanceSessions.find((s) => s.lecturerId === lecturerId && s.status === 'active');
    const withStatsAll = withStats(db, db.attendanceSessions.filter((s) => s.lecturerId === lecturerId), {
      hydrateLecturer: true,
    });
    const activeSession = activeSessionRow ? withStatsAll.find((s) => s.id === activeSessionRow.id) ?? null : null;
    const today = withStatsAll.filter((s) => s.sessionDate === todayISO() && s.status !== 'cancelled');
    const summaries = await this.getLecturerCourseSummary(lecturerId);
    const rates = summaries.map((s) => s.averageAttendance).filter((r): r is number => r !== null);
    const recentSessions = withStatsAll
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5);
    return {
      courseCount: await (async () => {
        const activeSessionRow2 = db.academicSessions.find((s) => s.isActive);
        return (
          await this.listAssignments({ lecturerId, academicSessionId: activeSessionRow2?.id })
        ).length;
      })(),
      activeSession,
      sessionsToday: today.length,
      averageAttendance: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
      recentSessions,
    };
  }

  async getStudentStats(studentId: string): Promise<import('./types').StudentStats> {
    const db = load();
    const activeSession = db.academicSessions.find((s) => s.isActive);
    const enrollments = db.enrollments.filter(
      (e) => e.studentId === studentId && (!activeSession || e.academicSessionId === activeSession.id)
    );
    const courseIds = new Set(enrollments.map((e) => e.courseId));
    const openSessions = withStats(db, db.attendanceSessions.filter((s) => s.status === 'active' && courseIds.has(s.courseId)), {
      hydrateLecturer: true,
    }).map((s) => {
      const lecturer = db.lecturers.find((l) => l.id === s.lecturerId);
      return { ...s, lecturerName: lecturer?.profile?.fullName };
    });
    const summaries = await this.getStudentCourseSummary(studentId, activeSession?.id);
    return {
      courseCount: enrollments.length,
      overallPercentage: overallPercentage(summaries),
      openSessions,
    };
  }
}
