import type {
  AcademicSession,
  AttendanceRecord,
  AttendanceSession,
  AttendanceStatus,
  Course,
  Department,
  Enrollment,
  Lecturer,
  LecturerCourse,
  Profile,
  SessionStatus,
  Student,
} from '../types';

// ── Input types ──────────────────────────────────────────────────────────────

export interface StudentInput {
  fullName: string;
  email: string;
  phone?: string;
  studentNumber: string;
  departmentId: string;
  level: number;
  /** Initial password for the new account (admin-created accounts). */
  password?: string;
}

export interface StudentUpdate {
  fullName?: string;
  email?: string;
  phone?: string;
  studentNumber?: string;
  departmentId?: string;
  level?: number;
  isActive?: boolean;
}

export interface LecturerInput {
  fullName: string;
  email: string;
  phone?: string;
  staffNumber: string;
  departmentId: string;
  password?: string;
}

export interface LecturerUpdate {
  fullName?: string;
  email?: string;
  phone?: string;
  staffNumber?: string;
  departmentId?: string;
  isActive?: boolean;
}

export interface CourseInput {
  code: string;
  title: string;
  departmentId: string;
  level: number;
  creditUnit: number;
}

export interface DepartmentInput {
  name: string;
  code: string;
}

export interface AcademicSessionInput {
  name: string;
  startDate: string;
  endDate: string;
}

export interface EnrollmentInput {
  courseId: string;
  studentId: string;
  academicSessionId: string;
}

export interface AssignmentInput {
  lecturerId: string;
  courseId: string;
  academicSessionId: string;
}

export interface StartSessionInput {
  courseId: string;
  lecturerId: string;
  academicSessionId: string;
  /** How long the QR token stays valid (minutes). */
  durationMinutes: number;
}

// ── Enriched / computed types ────────────────────────────────────────────────

export interface SessionStats {
  enrolled: number;
  present: number;
  late: number;
  absent: number;
}

export interface AttendanceSessionWithStats extends AttendanceSession {
  stats: SessionStats;
  /** Attendance rate 0–100 for this session, null when nobody enrolled. */
  rate: number | null;
}

export interface CourseStudentRow {
  student: Student;
  sessionsHeld: number;
  present: number;
  late: number;
  absent: number;
  /** (present + late) / sessionsHeld × 100 */
  percentage: number | null;
}

export interface StudentCourseRow {
  course: Course;
  sessionsHeld: number;
  attended: number; // present + late
  percentage: number | null;
}

export interface LecturerCourseRow {
  course: Course;
  sessionsHeld: number;
  enrolled: number;
  averageAttendance: number | null;
}

export interface AdminStats {
  students: number;
  lecturers: number;
  courses: number;
  departments: number;
  activeSessions: number;
  /** Institution-wide rate for today's sessions, null when none held yet. */
  todayRate: number | null;
}

export interface LecturerStats {
  courseCount: number;
  activeSession: AttendanceSessionWithStats | null;
  sessionsToday: number;
  averageAttendance: number | null;
  recentSessions: AttendanceSessionWithStats[];
}

export interface StudentStats {
  courseCount: number;
  overallPercentage: number | null;
  /** Attendance sessions currently OPEN for the student's courses. */
  openSessions: Array<AttendanceSessionWithStats & { lecturerName?: string }>;
}

export interface RecordAttendanceResult {
  sessionId: string;
  courseCode: string;
  courseTitle: string;
  sessionDate: string;
  markedAt: string;
  status: AttendanceStatus;
}

// ── The backend contract ─────────────────────────────────────────────────────
// Implemented twice: MockBackend (demo data in localStorage) and
// SupabaseBackend (real Supabase project). The UI only knows this interface.

export interface Backend {
  readonly mode: 'mock' | 'supabase';

  // Auth (doc §9)
  signIn(email: string, password: string): Promise<Profile>;
  signOut(): Promise<void>;
  getCurrentProfile(): Promise<Profile | null>;
  resetPassword(email: string): Promise<void>;
  changePassword(newPassword: string): Promise<void>;
  updateOwnProfile(input: { fullName?: string; phone?: string }): Promise<Profile>;

  // Academic sessions (doc §19)
  getActiveAcademicSession(): Promise<AcademicSession | null>;
  listAcademicSessions(): Promise<AcademicSession[]>;
  createAcademicSession(input: AcademicSessionInput): Promise<AcademicSession>;
  updateAcademicSession(id: string, input: Partial<AcademicSessionInput>): Promise<void>;
  activateAcademicSession(id: string): Promise<void>;
  deleteAcademicSession(id: string): Promise<void>;

  // Departments (doc §13)
  listDepartments(): Promise<Department[]>;
  createDepartment(input: DepartmentInput): Promise<Department>;
  updateDepartment(id: string, input: DepartmentInput): Promise<void>;
  deleteDepartment(id: string): Promise<void>;

  // Students (doc §14)
  listStudents(opts?: { search?: string; departmentId?: string }): Promise<Student[]>;
  createStudent(input: StudentInput): Promise<Student>;
  updateStudent(id: string, input: StudentUpdate): Promise<void>;
  deleteStudent(id: string): Promise<void>;

  // Lecturers (doc §15)
  listLecturers(opts?: { search?: string }): Promise<Lecturer[]>;
  createLecturer(input: LecturerInput): Promise<Lecturer>;
  updateLecturer(id: string, input: LecturerUpdate): Promise<void>;
  deleteLecturer(id: string): Promise<void>;

  // Courses (doc §16)
  listCourses(opts?: { search?: string; departmentId?: string }): Promise<Course[]>;
  createCourse(input: CourseInput): Promise<Course>;
  updateCourse(id: string, input: CourseInput): Promise<void>;
  deleteCourse(id: string): Promise<void>;

  // Enrollments (doc §17)
  listEnrollments(opts?: { courseId?: string; studentId?: string; academicSessionId?: string }): Promise<Enrollment[]>;
  createEnrollment(input: EnrollmentInput): Promise<Enrollment>;
  deleteEnrollment(id: string): Promise<void>;

  // Lecturer → course assignments (doc §18)
  listAssignments(opts?: { lecturerId?: string; courseId?: string; academicSessionId?: string }): Promise<LecturerCourse[]>;
  createAssignment(input: AssignmentInput): Promise<LecturerCourse>;
  deleteAssignment(id: string): Promise<void>;

  // Attendance sessions (doc §20)
  listAttendanceSessions(opts?: { lecturerId?: string; courseId?: string; status?: SessionStatus }): Promise<AttendanceSessionWithStats[]>;
  getAttendanceSession(id: string): Promise<AttendanceSessionWithStats>;
  startAttendanceSession(input: StartSessionInput): Promise<AttendanceSessionWithStats>;
  regenerateSessionToken(id: string, durationMinutes: number): Promise<AttendanceSessionWithStats>;
  setSessionStatus(id: string, status: SessionStatus): Promise<void>;

  // Attendance records (doc §21)
  listAttendanceRecords(opts: { sessionId?: string; studentId?: string; courseId?: string }): Promise<AttendanceRecord[]>;
  markAttendanceManual(sessionId: string, studentId: string, status?: AttendanceStatus): Promise<void>;
  deleteAttendanceRecord(id: string): Promise<void>;

  /** Full server-side validation pipeline (doc §29): token → session →
   *  enrollment → duplicate → insert. Throws BackendError with a specific code. */
  recordAttendanceByToken(token: string): Promise<RecordAttendanceResult>;

  // Role resolvers (doc §42)
  getStudentByProfile(profileId: string): Promise<Student | null>;
  getLecturerByProfile(profileId: string): Promise<Lecturer | null>;

  // Summaries & reports (doc §31)
  getCourseRoster(courseId: string, academicSessionId: string): Promise<Student[]>;
  getCourseAttendanceSummary(courseId: string): Promise<CourseStudentRow[]>;
  getStudentCourseSummary(studentId: string, academicSessionId?: string): Promise<StudentCourseRow[]>;
  getLecturerCourseSummary(lecturerId: string, academicSessionId?: string): Promise<LecturerCourseRow[]>;

  // Dashboards (doc §26–28, §83)
  getAdminStats(): Promise<AdminStats>;
  getLecturerStats(lecturerId: string): Promise<LecturerStats>;
  getStudentStats(studentId: string): Promise<StudentStats>;
}
