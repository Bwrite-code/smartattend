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
  Role,
  SessionStatus,
  Student,
} from '../types';
import { BackendError } from '../lib/errors';
import { todayISO } from '../lib/format';
import { supabase } from '../lib/supabase';
import {
  computeCourseStudentSummary,
  computeLecturerCourseSummary,
  computeSessionStatsMap,
  computeStudentCourseSummary,
  overallPercentage,
  rate,
} from './aggregate';
import type {
  AcademicSessionInput,
  AdminStats,
  AssignmentInput,
  AttendanceSessionWithStats,
  Backend,
  CourseInput,
  CourseStudentRow,
  DepartmentInput,
  EnrollmentInput,
  LecturerCourseRow,
  LecturerInput,
  LecturerStats,
  RecordAttendanceResult,
  SessionStats,
  StartSessionInput,
  StudentCourseRow,
  StudentInput,
  StudentStats,
} from './types';

// ── Small helpers ────────────────────────────────────────────────────────────

const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const randomToken = (): string => {
  let s = '';
  for (let i = 0; i < 10; i++) s += 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)];
  return `SA-${s}`;
};

const nowTime = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

type Row = Record<string, any>;

function mapProfile(r: Row): Profile {
  return {
    id: r.id,
    fullName: r.full_name ?? '',
    email: r.email ?? '',
    role: (r.role ?? 'student') as Role,
    phone: r.phone ?? null,
    avatarUrl: r.avatar_url ?? null,
    isActive: r.is_active ?? true,
    createdAt: r.created_at ?? '',
  };
}

function mapStudent(r: Row): Student {
  return {
    id: r.id,
    profileId: r.profile_id,
    studentNumber: r.student_number,
    departmentId: r.department_id,
    level: r.level,
    isActive: r.is_active ?? true,
    createdAt: r.created_at ?? '',
    profile: r.profile ? mapProfile(r.profile) : undefined,
    department: r.department ? mapDepartment(r.department) : undefined,
  };
}

function mapLecturer(r: Row): Lecturer {
  return {
    id: r.id,
    profileId: r.profile_id,
    staffNumber: r.staff_number,
    departmentId: r.department_id,
    isActive: r.is_active ?? true,
    createdAt: r.created_at ?? '',
    profile: r.profile ? mapProfile(r.profile) : undefined,
    department: r.department ? mapDepartment(r.department) : undefined,
  };
}

function mapDepartment(r: Row): Department {
  return { id: r.id, name: r.name, code: r.code, createdAt: r.created_at ?? '' };
}

function mapCourse(r: Row): Course {
  return {
    id: r.id,
    code: r.course_code,
    title: r.course_title,
    departmentId: r.department_id,
    level: r.level,
    creditUnit: r.credit_unit,
    createdAt: r.created_at ?? '',
    department: r.department ? mapDepartment(r.department) : undefined,
  };
}

function mapAcademicSession(r: Row): AcademicSession {
  return {
    id: r.id,
    name: r.name,
    startDate: r.start_date,
    endDate: r.end_date,
    isActive: r.is_active ?? false,
    createdAt: r.created_at ?? '',
  };
}

function mapSession(r: Row): AttendanceSession {
  return {
    id: r.id,
    courseId: r.course_id,
    lecturerId: r.lecturer_id,
    academicSessionId: r.academic_session_id,
    sessionDate: r.session_date,
    startTime: (r.start_time ?? '').slice(0, 5),
    endTime: (r.end_time ?? '').slice(0, 5),
    status: r.status,
    qrToken: r.qr_token,
    qrExpiresAt: r.qr_expires_at,
    createdAt: r.created_at ?? '',
    course: r.course ? mapCourse(r.course) : undefined,
  };
}

function mapRecord(r: Row): AttendanceRecord {
  return {
    id: r.id,
    attendanceSessionId: r.attendance_session_id,
    studentId: r.student_id,
    markedAt: r.marked_at,
    status: r.status,
    method: r.method,
    createdAt: r.created_at ?? '',
    student: r.student ? mapStudent(r.student) : undefined,
    session: r.session ? mapSession(r.session) : undefined,
  };
}

/** Translate Postgres/Supabase errors into friendly BackendErrors (doc §61). */
function translate(e: Row | null, fallback: string): never {
  const code = e?.code ?? '';
  const message = String(e?.message ?? '');
  const constraint = String(e?.details ?? '') + ' ' + message;
  if (code === '23505' || /duplicate key/i.test(message)) {
    if (/student_number/i.test(constraint)) throw new BackendError('duplicate', 'A student with this matriculation number already exists.');
    if (/staff_number/i.test(constraint)) throw new BackendError('duplicate', 'A lecturer with this staff number already exists.');
    if (/course_code/i.test(constraint)) throw new BackendError('duplicate', 'A course with this code already exists.');
    if (/departments?_code/i.test(constraint)) throw new BackendError('duplicate', 'A department with this code already exists.');
    if (/uq_enrollment/i.test(constraint)) throw new BackendError('duplicate', 'This student has already been enrolled in this course for this session.');
    if (/uq_lecturer_course/i.test(constraint)) throw new BackendError('duplicate', 'This course is already assigned to this lecturer for this session.');
    if (/uq_attendance_record/i.test(constraint)) throw new BackendError('already_marked', 'An attendance record already exists for this student in this session.');
    if (/academic_sessions/i.test(constraint)) throw new BackendError('duplicate', 'An academic session with this name already exists.');
    throw new BackendError('duplicate', 'This record already exists.');
  }
  if (code === '42501' || /row-level security/i.test(message))
    throw new BackendError('permission', 'You do not have permission to perform this action.');
  if (code === '23503')
    throw new BackendError('validation', 'This record is still referenced by other records.');
  throw new BackendError('unknown', e?.message ? `${fallback}: ${e.message}` : fallback);
}

async function invokeManageUser(body: Row): Promise<Row> {
  const { data, error } = await supabase.functions.invoke('manage-user', { body });
  if (error) {
    const msg = String(error.message ?? '');
    if (/fetch|Failed to send/i.test(msg))
      throw new BackendError(
        'unknown',
        'The manage-user Edge Function is not reachable. Deploy it with `supabase functions deploy manage-user` (see README → Supabase setup).'
      );
    throw new BackendError('unknown', msg || 'User management failed.');
  }
  const result = data as Row;
  if (result && result.ok === false) throw new BackendError(result.code ?? 'unknown', String(result.message ?? 'User management failed.'));
  return result;
}

/** Compute stats for a set of sessions (mirrors the mock backend exactly). */
async function attachStats(
  sessions: AttendanceSession[],
  withLecturer: boolean
): Promise<AttendanceSessionWithStats[]> {
  if (sessions.length === 0) return [];
  const sessionIds = sessions.map((s) => s.id);
  const courseIds = [...new Set(sessions.map((s) => s.courseId))];
  const sessionAcadIds = [...new Set(sessions.map((s) => s.academicSessionId))];

  const [recordsRes, enrollRes, lecturersRes] = await Promise.all([
    supabase.from('attendance_records').select('attendance_session_id, status').in('attendance_session_id', sessionIds),
    supabase
      .from('course_enrollments')
      .select('course_id, academic_session_id, student_id')
      .in('course_id', courseIds)
      .in('academic_session_id', sessionAcadIds),
    withLecturer
      ? supabase.from('lecturers').select('*, profile:profiles(*)').in('id', [...new Set(sessions.map((s) => s.lecturerId))])
      : Promise.resolve({ data: [] as Row[], error: null }),
  ]);
  if (recordsRes.error) translate(recordsRes.error, 'Could not load attendance counts');
  if (enrollRes.error) translate(enrollRes.error, 'Could not load enrollment counts');

  const records = (recordsRes.data ?? []) as Row[];
  const enrollments = ((enrollRes.data ?? []) as Row[]).filter((e) =>
    sessions.some((s) => s.courseId === e.course_id && s.academicSessionId === e.academic_session_id)
  );
  const lecturers = ((lecturersRes as Row).data ?? []) as Row[];

  const statsMap = computeSessionStatsMap(
    sessions,
    records.map((r) => ({ attendanceSessionId: r.attendance_session_id, status: r.status })) as unknown as AttendanceRecord[],
    enrollments.map((e) => ({ courseId: e.course_id, academicSessionId: e.academic_session_id })) as unknown as Enrollment[]
  );

  return sessions
    .map((s) => {
      const stats: SessionStats = statsMap[s.id] ?? { enrolled: 0, present: 0, late: 0, absent: 0 };
      const lec = withLecturer ? lecturers.find((l) => l.id === s.lecturerId) : undefined;
      return {
        ...s,
        lecturer: lec ? mapLecturer(lec) : s.lecturer,
        stats,
        rate: rate(stats.present + stats.late, stats.enrolled),
      };
    })
    .sort((a, b) => (b.sessionDate + b.startTime).localeCompare(a.sessionDate + a.startTime));
}

// ── The Supabase backend ─────────────────────────────────────────────────────

export class SupabaseBackend implements Backend {
  readonly mode = 'supabase' as const;

  // ── Auth ───────────────────────────────────────────────────────────────────

  private async fetchProfile(userId: string): Promise<Profile | null> {
    const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) translate(error, 'Could not load your profile');
    return data ? mapProfile(data) : null;
  }

  async signIn(email: string, password: string): Promise<Profile> {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      if (/invalid login/i.test(error.message))
        throw new BackendError('invalid_credentials', 'Incorrect email or password.');
      if (/not confirmed/i.test(error.message))
        throw new BackendError('invalid_credentials', 'Please confirm your email address first.');
      throw new BackendError('invalid_credentials', error.message);
    }
    const profile = await this.fetchProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      throw new BackendError('not_found', 'No profile is linked to this account. Contact the administrator.');
    }
    if (!profile.isActive) {
      await supabase.auth.signOut();
      throw new BackendError('account_inactive', 'This account has been deactivated. Contact the administrator.');
    }
    return profile;
  }

  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  async getCurrentProfile(): Promise<Profile | null> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    return this.fetchProfile(data.user.id);
  }

  async resetPassword(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw new BackendError('unknown', error.message);
  }

  async changePassword(newPassword: string): Promise<void> {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new BackendError('unknown', error.message);
  }

  async updateOwnProfile(input: { fullName?: string; phone?: string }): Promise<Profile> {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new BackendError('unauthenticated', 'Please sign in again.');
    const { data, error } = await supabase
      .from('profiles')
      .update({
        ...(input.fullName !== undefined ? { full_name: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
      })
      .eq('id', userData.user.id)
      .select('*')
      .single();
    if (error) translate(error, 'Could not update your profile');
    return mapProfile(data);
  }

  // ── Academic sessions ──────────────────────────────────────────────────────

  async getActiveAcademicSession(): Promise<AcademicSession | null> {
    const { data, error } = await supabase.from('academic_sessions').select('*').eq('is_active', true).maybeSingle();
    if (error) translate(error, 'Could not load the active academic session');
    return data ? mapAcademicSession(data) : null;
  }

  async listAcademicSessions(): Promise<AcademicSession[]> {
    const { data, error } = await supabase.from('academic_sessions').select('*').order('name', { ascending: false });
    if (error) translate(error, 'Could not load academic sessions');
    return (data ?? []).map(mapAcademicSession);
  }

  async createAcademicSession(input: AcademicSessionInput): Promise<AcademicSession> {
    const { data, error } = await supabase
      .from('academic_sessions')
      .insert({ name: input.name.trim(), start_date: input.startDate, end_date: input.endDate })
      .select('*')
      .single();
    if (error) translate(error, 'Could not create the academic session');
    return mapAcademicSession(data);
  }

  async updateAcademicSession(id: string, input: Partial<AcademicSessionInput>): Promise<void> {
    const payload: Row = {};
    if (input.name !== undefined) payload.name = input.name.trim();
    if (input.startDate !== undefined) payload.start_date = input.startDate;
    if (input.endDate !== undefined) payload.end_date = input.endDate;
    const { error } = await supabase.from('academic_sessions').update(payload).eq('id', id);
    if (error) translate(error, 'Could not update the academic session');
  }

  async activateAcademicSession(id: string): Promise<void> {
    // Two-step under a client without transactions: clear, then set.
    const { error: e1 } = await supabase.rpc('activate_academic_session', { p_session_id: id });
    if (e1) translate(e1, 'Could not activate the academic session');
  }

  async deleteAcademicSession(id: string): Promise<void> {
    const { error } = await supabase.from('academic_sessions').delete().eq('id', id);
    if (error) translate(error, 'Could not delete the academic session');
  }

  // ── Departments ────────────────────────────────────────────────────────────

  async listDepartments(): Promise<Department[]> {
    const { data, error } = await supabase.from('departments').select('*').order('name');
    if (error) translate(error, 'Could not load departments');
    return (data ?? []).map(mapDepartment);
  }

  async createDepartment(input: DepartmentInput): Promise<Department> {
    const { data, error } = await supabase
      .from('departments')
      .insert({ name: input.name.trim(), code: input.code.trim().toUpperCase() })
      .select('*')
      .single();
    if (error) translate(error, 'Could not create the department');
    return mapDepartment(data);
  }

  async updateDepartment(id: string, input: DepartmentInput): Promise<void> {
    const { error } = await supabase
      .from('departments')
      .update({ name: input.name.trim(), code: input.code.trim().toUpperCase() })
      .eq('id', id);
    if (error) translate(error, 'Could not update the department');
  }

  async deleteDepartment(id: string): Promise<void> {
    const { error } = await supabase.from('departments').delete().eq('id', id);
    if (error) translate(error, 'Could not delete the department');
  }

  // ── Students ───────────────────────────────────────────────────────────────

  async listStudents(opts?: { search?: string; departmentId?: string }): Promise<Student[]> {
    let q = supabase
      .from('students')
      .select('*, profile:profiles(*), department:departments(*)')
      .order('student_number');
    if (opts?.departmentId) q = q.eq('department_id', opts.departmentId);
    if (opts?.search) q = q.or(`student_number.ilike.%${opts.search}%,profile.full_name.ilike.%${opts.search}%`);
    const { data, error } = await q;
    if (error) translate(error, 'Could not load students');
    return (data ?? []).map(mapStudent).sort((a, b) =>
      (a.profile?.fullName ?? '').localeCompare(b.profile?.fullName ?? '')
    );
  }

  async createStudent(input: StudentInput): Promise<Student> {
    const result = await invokeManageUser({
      action: 'create',
      role: 'student',
      email: input.email.trim(),
      password: input.password?.trim() || undefined,
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      studentNumber: input.studentNumber.trim().toUpperCase(),
      departmentId: input.departmentId,
      level: input.level,
    });
    const { data, error } = await supabase
      .from('students')
      .select('*, profile:profiles(*), department:departments(*)')
      .eq('id', result.student_id)
      .single();
    if (error) translate(error, 'Student account created, but the record could not be loaded');
    return mapStudent(data);
  }

  async updateStudent(id: string, input: Partial<StudentInput> & { isActive?: boolean }): Promise<void> {
    const { data: current } = await supabase
      .from('students')
      .select('profile_id')
      .eq('id', id)
      .single();
    const studentPayload: Row = {};
    if (input.studentNumber !== undefined) studentPayload.student_number = input.studentNumber.trim().toUpperCase();
    if (input.departmentId !== undefined) studentPayload.department_id = input.departmentId;
    if (input.level !== undefined) studentPayload.level = input.level;
    if (input.isActive !== undefined) studentPayload.is_active = input.isActive;
    if (Object.keys(studentPayload).length > 0) {
      const { error } = await supabase.from('students').update(studentPayload).eq('id', id);
      if (error) translate(error, 'Could not update the student');
    }
    const profilePayload: Row = {};
    if (input.fullName !== undefined) profilePayload.full_name = input.fullName.trim();
    if (input.phone !== undefined) profilePayload.phone = input.phone.trim() || null;
    if (input.isActive !== undefined) profilePayload.is_active = input.isActive;
    if (Object.keys(profilePayload).length > 0 && current?.profile_id) {
      const { error } = await supabase.from('profiles').update(profilePayload).eq('id', current.profile_id);
      if (error) translate(error, 'Could not update the student profile');
    }
    if (input.email !== undefined && current?.profile_id) {
      await invokeManageUser({ action: 'update-email', userId: current.profile_id, email: input.email.trim() });
    }
  }

  async deleteStudent(id: string): Promise<void> {
    const { data } = await supabase.from('students').select('profile_id').eq('id', id).single();
    const { error } = await supabase.from('students').delete().eq('id', id);
    if (error) translate(error, 'Could not delete the student');
    if (data?.profile_id) await invokeManageUser({ action: 'delete', userId: data.profile_id });
  }

  // ── Lecturers ──────────────────────────────────────────────────────────────

  async listLecturers(opts?: { search?: string }): Promise<Lecturer[]> {
    let q = supabase
      .from('lecturers')
      .select('*, profile:profiles(*), department:departments(*)')
      .order('staff_number');
    if (opts?.search) q = q.or(`staff_number.ilike.%${opts.search}%,profile.full_name.ilike.%${opts.search}%`);
    const { data, error } = await q;
    if (error) translate(error, 'Could not load lecturers');
    return (data ?? []).map(mapLecturer).sort((a, b) =>
      (a.profile?.fullName ?? '').localeCompare(b.profile?.fullName ?? '')
    );
  }

  async createLecturer(input: LecturerInput): Promise<Lecturer> {
    const result = await invokeManageUser({
      action: 'create',
      role: 'lecturer',
      email: input.email.trim(),
      password: input.password?.trim() || undefined,
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      staffNumber: input.staffNumber.trim().toUpperCase(),
      departmentId: input.departmentId,
    });
    const { data, error } = await supabase
      .from('lecturers')
      .select('*, profile:profiles(*), department:departments(*)')
      .eq('id', result.lecturer_id)
      .single();
    if (error) translate(error, 'Lecturer account created, but the record could not be loaded');
    return mapLecturer(data);
  }

  async updateLecturer(id: string, input: Partial<LecturerInput> & { isActive?: boolean }): Promise<void> {
    const { data: current } = await supabase.from('lecturers').select('profile_id').eq('id', id).single();
    const lecturerPayload: Row = {};
    if (input.staffNumber !== undefined) lecturerPayload.staff_number = input.staffNumber.trim().toUpperCase();
    if (input.departmentId !== undefined) lecturerPayload.department_id = input.departmentId;
    if (input.isActive !== undefined) lecturerPayload.is_active = input.isActive;
    if (Object.keys(lecturerPayload).length > 0) {
      const { error } = await supabase.from('lecturers').update(lecturerPayload).eq('id', id);
      if (error) translate(error, 'Could not update the lecturer');
    }
    const profilePayload: Row = {};
    if (input.fullName !== undefined) profilePayload.full_name = input.fullName.trim();
    if (input.phone !== undefined) profilePayload.phone = input.phone.trim() || null;
    if (input.isActive !== undefined) profilePayload.is_active = input.isActive;
    if (Object.keys(profilePayload).length > 0 && current?.profile_id) {
      const { error } = await supabase.from('profiles').update(profilePayload).eq('id', current.profile_id);
      if (error) translate(error, 'Could not update the lecturer profile');
    }
    if (input.email !== undefined && current?.profile_id) {
      await invokeManageUser({ action: 'update-email', userId: current.profile_id, email: input.email.trim() });
    }
  }

  async deleteLecturer(id: string): Promise<void> {
    const { data } = await supabase.from('lecturers').select('profile_id').eq('id', id).single();
    const { error } = await supabase.from('lecturers').delete().eq('id', id);
    if (error) translate(error, 'Could not delete the lecturer');
    if (data?.profile_id) await invokeManageUser({ action: 'delete', userId: data.profile_id });
  }

  // ── Courses ────────────────────────────────────────────────────────────────

  async listCourses(opts?: { search?: string; departmentId?: string }): Promise<Course[]> {
    let q = supabase
      .from('courses')
      .select('*, department:departments(*)')
      .order('course_code');
    if (opts?.departmentId) q = q.eq('department_id', opts.departmentId);
    if (opts?.search) q = q.or(`course_code.ilike.%${opts.search}%,course_title.ilike.%${opts.search}%`);
    const { data, error } = await q;
    if (error) translate(error, 'Could not load courses');
    return (data ?? []).map(mapCourse);
  }

  async createCourse(input: CourseInput): Promise<Course> {
    const { data, error } = await supabase
      .from('courses')
      .insert({
        course_code: input.code.trim().toUpperCase(),
        course_title: input.title.trim(),
        department_id: input.departmentId,
        level: input.level,
        credit_unit: input.creditUnit,
      })
      .select('*, department:departments(*)')
      .single();
    if (error) translate(error, 'Could not create the course');
    return mapCourse(data);
  }

  async updateCourse(id: string, input: CourseInput): Promise<void> {
    const { error } = await supabase
      .from('courses')
      .update({
        course_code: input.code.trim().toUpperCase(),
        course_title: input.title.trim(),
        department_id: input.departmentId,
        level: input.level,
        credit_unit: input.creditUnit,
      })
      .eq('id', id);
    if (error) translate(error, 'Could not update the course');
  }

  async deleteCourse(id: string): Promise<void> {
    const { error } = await supabase.from('courses').delete().eq('id', id);
    if (error) translate(error, 'Could not delete the course');
  }

  // ── Enrollments ────────────────────────────────────────────────────────────

  async listEnrollments(opts?: { courseId?: string; studentId?: string; academicSessionId?: string }): Promise<Enrollment[]> {
    let q = supabase
      .from('course_enrollments')
      .select(
        '*, student:students(*, profile:profiles(*), department:departments(*)), course:courses(*, department:departments(*))'
      )
      .order('created_at', { ascending: false });
    if (opts?.courseId) q = q.eq('course_id', opts.courseId);
    if (opts?.studentId) q = q.eq('student_id', opts.studentId);
    if (opts?.academicSessionId) q = q.eq('academic_session_id', opts.academicSessionId);
    const { data, error } = await q;
    if (error) translate(error, 'Could not load enrollments');
    return (data ?? []).map((r: Row) => ({
      id: r.id,
      courseId: r.course_id,
      studentId: r.student_id,
      academicSessionId: r.academic_session_id,
      createdAt: r.created_at,
      student: r.student ? mapStudent(r.student) : undefined,
      course: r.course ? mapCourse(r.course) : undefined,
    }));
  }

  async createEnrollment(input: EnrollmentInput): Promise<Enrollment> {
    const { data, error } = await supabase
      .from('course_enrollments')
      .insert({
        course_id: input.courseId,
        student_id: input.studentId,
        academic_session_id: input.academicSessionId,
      })
      .select('id, course_id, student_id, academic_session_id, created_at')
      .single();
    if (error) translate(error, 'Could not create the enrollment');
    return {
      id: data!.id,
      courseId: data!.course_id,
      studentId: data!.student_id,
      academicSessionId: data!.academic_session_id,
      createdAt: data!.created_at,
    };
  }

  async deleteEnrollment(id: string): Promise<void> {
    const { error } = await supabase.from('course_enrollments').delete().eq('id', id);
    if (error) translate(error, 'Could not remove the enrollment');
  }

  // ── Assignments ────────────────────────────────────────────────────────────

  async listAssignments(opts?: { lecturerId?: string; courseId?: string; academicSessionId?: string }): Promise<LecturerCourse[]> {
    let q = supabase
      .from('lecturer_courses')
      .select(
        '*, lecturer:lecturers(*, profile:profiles(*), department:departments(*)), course:courses(*, department:departments(*))'
      )
      .order('created_at', { ascending: false });
    if (opts?.lecturerId) q = q.eq('lecturer_id', opts.lecturerId);
    if (opts?.courseId) q = q.eq('course_id', opts.courseId);
    if (opts?.academicSessionId) q = q.eq('academic_session_id', opts.academicSessionId);
    const { data, error } = await q;
    if (error) translate(error, 'Could not load course assignments');
    return (data ?? []).map((r: Row) => ({
      id: r.id,
      lecturerId: r.lecturer_id,
      courseId: r.course_id,
      academicSessionId: r.academic_session_id,
      createdAt: r.created_at,
      lecturer: r.lecturer ? mapLecturer(r.lecturer) : undefined,
      course: r.course ? mapCourse(r.course) : undefined,
    }));
  }

  async createAssignment(input: AssignmentInput): Promise<LecturerCourse> {
    const { data, error } = await supabase
      .from('lecturer_courses')
      .insert({
        lecturer_id: input.lecturerId,
        course_id: input.courseId,
        academic_session_id: input.academicSessionId,
      })
      .select('id, lecturer_id, course_id, academic_session_id, created_at')
      .single();
    if (error) translate(error, 'Could not assign the course');
    return {
      id: data!.id,
      lecturerId: data!.lecturer_id,
      courseId: data!.course_id,
      academicSessionId: data!.academic_session_id,
      createdAt: data!.created_at,
    };
  }

  async deleteAssignment(id: string): Promise<void> {
    const { error } = await supabase.from('lecturer_courses').delete().eq('id', id);
    if (error) translate(error, 'Could not remove the assignment');
  }

  // ── Attendance sessions ────────────────────────────────────────────────────

  async listAttendanceSessions(opts?: { lecturerId?: string; courseId?: string; status?: SessionStatus }): Promise<AttendanceSessionWithStats[]> {
    let q = supabase
      .from('attendance_sessions')
      .select('*, course:courses(*, department:departments(*))')
      .order('session_date', { ascending: false })
      .order('start_time', { ascending: false });
    if (opts?.lecturerId) q = q.eq('lecturer_id', opts.lecturerId);
    if (opts?.courseId) q = q.eq('course_id', opts.courseId);
    if (opts?.status) q = q.eq('status', opts.status);
    const { data, error } = await q;
    if (error) translate(error, 'Could not load attendance sessions');
    return attachStats((data ?? []).map(mapSession), true);
  }

  async getAttendanceSession(id: string): Promise<AttendanceSessionWithStats> {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select('*, course:courses(*, department:departments(*))')
      .eq('id', id)
      .maybeSingle();
    if (error) translate(error, 'Could not load the attendance session');
    if (!data) throw new BackendError('not_found', 'Attendance session not found.');
    const rows = await attachStats([mapSession(data)], true);
    return rows[0]!;
  }

  async startAttendanceSession(input: StartSessionInput): Promise<AttendanceSessionWithStats> {
    const duration = Math.max(1, Math.min(240, input.durationMinutes || 15));
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + duration);
    const { data, error } = await supabase
      .from('attendance_sessions')
      .insert({
        course_id: input.courseId,
        lecturer_id: input.lecturerId,
        academic_session_id: input.academicSessionId,
        session_date: todayISO(),
        start_time: nowTime(),
        end_time: nowTime(),
        status: 'active',
        qr_token: randomToken(),
        qr_expires_at: expires.toISOString(),
      })
      .select('*, course:courses(*, department:departments(*))')
      .single();
    if (error) translate(error, 'Could not start the attendance session');
    const rows = await attachStats([mapSession(data)], true);
    return rows[0]!;
  }

  async regenerateSessionToken(id: string, durationMinutes: number): Promise<AttendanceSessionWithStats> {
    const duration = Math.max(1, Math.min(240, durationMinutes || 15));
    const expires = new Date();
    expires.setMinutes(expires.getMinutes() + duration);
    const { data, error } = await supabase
      .from('attendance_sessions')
      .update({ qr_token: randomToken(), qr_expires_at: expires.toISOString(), status: 'active' })
      .eq('id', id)
      .select('*, course:courses(*, department:departments(*))')
      .single();
    if (error) translate(error, 'Could not refresh the QR code');
    const rows = await attachStats([mapSession(data)], true);
    return rows[0]!;
  }

  async setSessionStatus(id: string, status: SessionStatus): Promise<void> {
    const { error } = await supabase.from('attendance_sessions').update({ status }).eq('id', id);
    if (error) translate(error, 'Could not update the session');
  }

  // ── Attendance records ─────────────────────────────────────────────────────

  async listAttendanceRecords(opts: { sessionId?: string; studentId?: string; courseId?: string }): Promise<AttendanceRecord[]> {
    let q = supabase
      .from('attendance_records')
      .select(
        '*, student:students(*, profile:profiles(*), department:departments(*)), session:attendance_sessions(*, course:courses(*, department:departments(*)))'
      )
      .order('marked_at', { ascending: false })
      .limit(1000);
    if (opts.sessionId) q = q.eq('attendance_session_id', opts.sessionId);
    if (opts.studentId) q = q.eq('student_id', opts.studentId);
    if (opts.courseId) q = q.eq('session.course_id', opts.courseId);
    const { data, error } = await q;
    if (error) translate(error, 'Could not load attendance records');
    return (data ?? []).map(mapRecord);
  }

  async markAttendanceManual(sessionId: string, studentId: string, status: 'present' | 'late' = 'present'): Promise<void> {
    const { error } = await supabase
      .from('attendance_records')
      .insert({ attendance_session_id: sessionId, student_id: studentId, status, method: 'manual' });
    if (error) translate(error, 'Could not mark attendance');
  }

  async deleteAttendanceRecord(id: string): Promise<void> {
    const { error } = await supabase.from('attendance_records').delete().eq('id', id);
    if (error) translate(error, 'Could not remove the attendance record');
  }

  async recordAttendanceByToken(token: string): Promise<RecordAttendanceResult> {
    const { data, error } = await supabase.rpc('record_attendance', { p_token: token.trim() });
    if (error) translate(error, 'Attendance could not be recorded');
    const result = data as Row;
    if (!result) throw new BackendError('unknown', 'Attendance could not be recorded.');
    if (result.ok === false) throw new BackendError(result.code ?? 'unknown', String(result.message));
    return {
      sessionId: String(result.session_id),
      courseCode: String(result.course_code ?? ''),
      courseTitle: String(result.course_title ?? ''),
      sessionDate: String(result.session_date ?? ''),
      markedAt: String(result.marked_at ?? new Date().toISOString()),
      status: (result.status ?? 'present') as 'present' | 'late',
    };
  }

  // ── Role resolvers ─────────────────────────────────────────────────────────

  async getStudentByProfile(profileId: string): Promise<Student | null> {
    const { data, error } = await supabase
      .from('students')
      .select('*, profile:profiles(*), department:departments(*)')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (error) translate(error, 'Could not load your student record');
    return data ? mapStudent(data) : null;
  }

  async getLecturerByProfile(profileId: string): Promise<Lecturer | null> {
    const { data, error } = await supabase
      .from('lecturers')
      .select('*, profile:profiles(*), department:departments(*)')
      .eq('profile_id', profileId)
      .maybeSingle();
    if (error) translate(error, 'Could not load your lecturer record');
    return data ? mapLecturer(data) : null;
  }

  // ── Summaries & reports ────────────────────────────────────────────────────

  async getCourseRoster(courseId: string, academicSessionId: string): Promise<Student[]> {
    const { data, error } = await supabase
      .from('course_enrollments')
      .select('student:students(*, profile:profiles(*), department:departments(*))')
      .eq('course_id', courseId)
      .eq('academic_session_id', academicSessionId);
    if (error) translate(error, 'Could not load the course roster');
    return (data ?? [])
      .map((r: Row) => (r.student ? mapStudent(r.student) : null))
      .filter((s): s is Student => Boolean(s))
      .sort((a, b) => (a.profile?.fullName ?? '').localeCompare(b.profile?.fullName ?? ''));
  }

  async getCourseAttendanceSummary(courseId: string): Promise<CourseStudentRow[]> {
    const { data: sessions, error: e1 } = await supabase
      .from('attendance_sessions')
      .select('*')
      .eq('course_id', courseId);
    if (e1) translate(e1, 'Could not load course sessions');
    const sessionRows = (sessions ?? []).map(mapSession);
    const sessionIds = sessionRows.map((s) => s.id);
    if (sessionIds.length === 0) return [];

    const acadIds = [...new Set(sessionRows.map((s) => s.academicSessionId))];
    const [recordsRes, enrollRes] = await Promise.all([
      supabase
        .from('attendance_records')
        .select('attendance_session_id, status, student_id')
        .in('attendance_session_id', sessionIds),
      supabase
        .from('course_enrollments')
        .select('student_id, academic_session_id')
        .eq('course_id', courseId)
        .in('academic_session_id', acadIds),
    ]);
    if (recordsRes.error) translate(recordsRes.error, 'Could not load attendance records');
    if (enrollRes.error) translate(enrollRes.error, 'Could not load enrollments');

    const studentIds = [...new Set(((enrollRes.data ?? []) as Row[]).map((e) => e.student_id))];
    if (studentIds.length === 0) return [];
    const { data: students, error: e3 } = await supabase
      .from('students')
      .select('*, profile:profiles(*), department:departments(*)')
      .in('id', studentIds);
    if (e3) translate(e3, 'Could not load students');

    const records = ((recordsRes.data ?? []) as Row[]).map((r) => ({
      attendanceSessionId: r.attendance_session_id,
      studentId: r.student_id,
      status: r.status,
    })) as unknown as AttendanceRecord[];

    return computeCourseStudentSummary(sessionRows, records, (students ?? []).map(mapStudent));
  }

  async getStudentCourseSummary(studentId: string, academicSessionId?: string): Promise<StudentCourseRow[]> {
    let q = supabase
      .from('course_enrollments')
      .select('course:courses(*, department:departments(*))')
      .eq('student_id', studentId);
    if (academicSessionId) q = q.eq('academic_session_id', academicSessionId);
    const { data, error } = await q;
    if (error) translate(error, 'Could not load your courses');
    const courses = (data ?? []).map((r: Row) => mapCourse(r.course)).filter(Boolean);

    if (courses.length === 0) return [];
    const courseIds = courses.map((c) => c.id);
    let sq = supabase.from('attendance_sessions').select('*').in('course_id', courseIds);
    if (academicSessionId) sq = sq.eq('academic_session_id', academicSessionId);
    const { data: sessions, error: e2 } = await sq;
    if (e2) translate(e2, 'Could not load course sessions');
    const sessionRows = (sessions ?? []).map(mapSession);
    const sessionIds = sessionRows.map((s) => s.id);
    if (sessionIds.length === 0)
      return computeStudentCourseSummary(courses, [], []);

    const { data: records, error: e3 } = await supabase
      .from('attendance_records')
      .select('attendance_session_id, status')
      .eq('student_id', studentId)
      .in('attendance_session_id', sessionIds);
    if (e3) translate(e3, 'Could not load your attendance records');

    return computeStudentCourseSummary(
      courses,
      sessionRows,
      ((records ?? []) as Row[]).map((r) => ({
        attendanceSessionId: r.attendance_session_id,
        studentId,
        status: r.status,
      })) as unknown as AttendanceRecord[]
    );
  }

  async getLecturerCourseSummary(lecturerId: string, academicSessionId?: string): Promise<LecturerCourseRow[]> {
    let aq = supabase
      .from('lecturer_courses')
      .select('course:courses(*, department:departments(*))')
      .eq('lecturer_id', lecturerId);
    if (academicSessionId) aq = aq.eq('academic_session_id', academicSessionId);
    const { data: assignments, error: e1 } = await aq;
    if (e1) translate(e1, 'Could not load your courses');
    const courses = (assignments ?? []).map((r: Row) => mapCourse(r.course)).filter(Boolean);
    if (courses.length === 0) return [];

    const courseIds = courses.map((c) => c.id);
    let sq = supabase.from('attendance_sessions').select('*').eq('lecturer_id', lecturerId).in('course_id', courseIds);
    if (academicSessionId) sq = sq.eq('academic_session_id', academicSessionId);
    const { data: sessions, error: e2 } = await sq;
    if (e2) translate(e2, 'Could not load sessions');
    const sessionRows = (sessions ?? []).map(mapSession);
    const sessionIds = sessionRows.map((s) => s.id);

    const [recordsRes, enrollRes] = await Promise.all([
      sessionIds.length
        ? supabase
            .from('attendance_records')
            .select('attendance_session_id, status')
            .in('attendance_session_id', sessionIds)
        : Promise.resolve({ data: [], error: null } as unknown as { data: Row[] | null; error: null }),
      supabase
        .from('course_enrollments')
        .select('course_id, academic_session_id, student_id')
        .in('course_id', courseIds),
    ]);
    if (recordsRes.error) translate(recordsRes.error, 'Could not load records');
    if (enrollRes.error) translate(enrollRes.error, 'Could not load enrollments');

    const records = ((recordsRes.data ?? []) as Row[]).map((r) => ({
      attendanceSessionId: r.attendance_session_id,
      status: r.status,
    })) as unknown as AttendanceRecord[];
    const enrollments = ((enrollRes.data ?? []) as Row[]).map(
      (e) => ({ courseId: e.course_id, academicSessionId: e.academic_session_id }) as unknown as Enrollment
    );

    return computeLecturerCourseSummary(courses, sessionRows, records, enrollments);
  }

  // ── Dashboards ─────────────────────────────────────────────────────────────

  async getAdminStats(): Promise<AdminStats> {
    const [students, lecturers, courses, departments, active, today] = await Promise.all([
      supabase.from('students').select('id', { count: 'exact', head: true }),
      supabase.from('lecturers').select('id', { count: 'exact', head: true }),
      supabase.from('courses').select('id', { count: 'exact', head: true }),
      supabase.from('departments').select('id', { count: 'exact', head: true }),
      supabase.from('attendance_sessions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('attendance_sessions').select('*').eq('session_date', todayISO()).neq('status', 'cancelled'),
    ]);
    let todayRate: number | null = null;
    const todaySessions = (today.data ?? []).map(mapSession);
    if (todaySessions.length > 0) {
      const statsRows = await attachStats(todaySessions, false);
      const attended = statsRows.reduce((acc, s) => acc + s.stats.present + s.stats.late, 0);
      const capacity = statsRows.reduce((acc, s) => acc + s.stats.enrolled, 0);
      todayRate = rate(attended, capacity);
    }
    return {
      students: students.count ?? 0,
      lecturers: lecturers.count ?? 0,
      courses: courses.count ?? 0,
      departments: departments.count ?? 0,
      activeSessions: active.count ?? 0,
      todayRate,
    };
  }

  async getLecturerStats(lecturerId: string): Promise<LecturerStats> {
    const activeAcad = await this.getActiveAcademicSession();
    const [assignments, sessions] = await Promise.all([
      this.listAssignments({ lecturerId, academicSessionId: activeAcad?.id }),
      this.listAttendanceSessions({ lecturerId }),
    ]);
    const activeSession = sessions.find((s) => s.status === 'active') ?? null;
    const todayStr = todayISO();
    const sessionsToday = sessions.filter((s) => s.sessionDate === todayStr && s.status !== 'cancelled').length;
    const summaries = await this.getLecturerCourseSummary(lecturerId, activeAcad?.id);
    const rates = summaries.map((s) => s.averageAttendance).filter((r): r is number => r !== null);
    return {
      courseCount: assignments.length,
      activeSession,
      sessionsToday,
      averageAttendance: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null,
      recentSessions: sessions.slice(0, 5),
    };
  }

  async getStudentStats(studentId: string): Promise<StudentStats> {
    const activeAcad = await this.getActiveAcademicSession();
    const enrollments = await this.listEnrollments({ studentId, academicSessionId: activeAcad?.id });
    const courseIds = new Set(enrollments.map((e) => e.courseId));
    const open = courseIds.size
      ? (await this.listAttendanceSessions({ status: 'active' })).filter((s) => courseIds.has(s.courseId))
      : [];
    const summaries = await this.getStudentCourseSummary(studentId, activeAcad?.id);
    return {
      courseCount: enrollments.length,
      overallPercentage: overallPercentage(summaries),
      openSessions: open.map((s) => ({
        ...s,
        lecturerName: s.lecturer?.profile?.fullName,
      })),
    };
  }
}
