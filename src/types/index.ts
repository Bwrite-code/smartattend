// ── Domain types shared across the whole application ─────────────────────────

export type Role = 'admin' | 'lecturer' | 'student';
export type AttendanceStatus = 'present' | 'late' | 'absent';
export type AttendanceMethod = 'qr' | 'manual';
export type SessionStatus = 'active' | 'closed' | 'cancelled';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  phone: string | null;
  avatarUrl: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  createdAt: string;
}

export interface Student {
  id: string;
  profileId: string;
  studentNumber: string;
  departmentId: string;
  level: number;
  isActive: boolean;
  createdAt: string;
  profile?: Profile;
  department?: Department;
}

export interface Lecturer {
  id: string;
  profileId: string;
  staffNumber: string;
  departmentId: string;
  isActive: boolean;
  createdAt: string;
  profile?: Profile;
  department?: Department;
}

export interface Course {
  id: string;
  code: string;
  title: string;
  departmentId: string;
  level: number;
  creditUnit: number;
  createdAt: string;
  department?: Department;
}

export interface AcademicSession {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  isActive: boolean;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  studentId: string;
  academicSessionId: string;
  createdAt: string;
  student?: Student;
  course?: Course;
  academicSession?: AcademicSession;
}

export interface LecturerCourse {
  id: string;
  lecturerId: string;
  courseId: string;
  academicSessionId: string;
  createdAt: string;
  lecturer?: Lecturer;
  course?: Course;
  academicSession?: AcademicSession;
}

export interface AttendanceSession {
  id: string;
  courseId: string;
  lecturerId: string;
  academicSessionId: string;
  sessionDate: string; // YYYY-MM-DD
  startTime: string;   // HH:mm
  endTime: string;     // HH:mm
  status: SessionStatus;
  qrToken: string;
  qrExpiresAt: string; // ISO datetime
  createdAt: string;
  course?: Course;
  lecturer?: Lecturer;
}

export interface AttendanceRecord {
  id: string;
  attendanceSessionId: string;
  studentId: string;
  markedAt: string; // ISO datetime
  status: AttendanceStatus;
  method: AttendanceMethod;
  createdAt: string;
  student?: Student;
  session?: AttendanceSession;
}
