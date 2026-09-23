import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth, homeForRole } from './context/AuthContext';
import { PageLoader } from './components/ui';
import type { Role } from './types';

import { AdminLayout } from './layouts/AdminLayout';
import { LecturerLayout } from './layouts/LecturerLayout';
import { StudentLayout } from './layouts/StudentLayout';

import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { AttendPage } from './pages/attend/AttendPage';

import { AdminDashboard } from './pages/admin/AdminDashboard';
import { StudentsPage } from './pages/admin/StudentsPage';
import { LecturersPage } from './pages/admin/LecturersPage';
import { DepartmentsPage } from './pages/admin/DepartmentsPage';
import { CoursesPage } from './pages/admin/CoursesPage';
import { EnrollmentsPage } from './pages/admin/EnrollmentsPage';
import { AssignmentsPage } from './pages/admin/AssignmentsPage';
import { AcademicSessionsPage } from './pages/admin/AcademicSessionsPage';
import { AdminAttendancePage } from './pages/admin/AttendancePage';
import { AdminAttendanceDetailPage } from './pages/admin/AttendanceDetailPage';
import { AdminReportsPage } from './pages/admin/ReportsPage';
import { AdminSettingsPage } from './pages/admin/SettingsPage';

import { LecturerDashboard } from './pages/lecturer/LecturerDashboard';
import { LecturerCoursesPage } from './pages/lecturer/CoursesPage';
import { LecturerCourseDetailPage } from './pages/lecturer/CourseDetailPage';
import { LecturerSessionsPage } from './pages/lecturer/SessionsPage';
import { LecturerSessionDetailPage } from './pages/lecturer/SessionDetailPage';
import { LecturerReportsPage } from './pages/lecturer/ReportsPage';

import { StudentDashboard } from './pages/student/StudentDashboard';
import { StudentCoursesPage } from './pages/student/CoursesPage';
import { ScanPage } from './pages/student/ScanPage';
import { StudentAttendancePage } from './pages/student/AttendancePage';
import { StudentProfilePage } from './pages/student/ProfilePage';

/** Blocks a route until the expected role is authenticated (doc §36: the UI
 *  gate is UX; the database enforces the real permissions via RLS). Nested
 *  routes render through the layout's <Outlet/>. */
function RequireRole({ role, layout }: { role: Role; layout: ReactNode }) {
  const { profile, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader label="Checking your session…" />;
  if (!profile) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (profile.role !== role) return <Navigate to={homeForRole(profile.role)} replace />;
  return <>{layout}</>;
}

function RootRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <PageLoader label="Loading SmartAttend…" />;
  return <Navigate to={profile ? homeForRole(profile.role) : '/login'} replace />;
}

function LoginGate() {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  if (loading) return <PageLoader label="Loading SmartAttend…" />;
  if (profile) return <Navigate to={from && from !== '/login' ? from : homeForRole(profile.role)} replace />;
  return <LoginPage />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login" element={<LoginGate />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/attend/:token" element={<AttendPage />} />

      <Route path="/admin" element={<RequireRole role="admin" layout={<AdminLayout />} />}>
        <Route index element={<AdminDashboard />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="lecturers" element={<LecturersPage />} />
        <Route path="departments" element={<DepartmentsPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="enrollments" element={<EnrollmentsPage />} />
        <Route path="assignments" element={<AssignmentsPage />} />
        <Route path="sessions" element={<AcademicSessionsPage />} />
        <Route path="attendance" element={<AdminAttendancePage />} />
        <Route path="attendance/:id" element={<AdminAttendanceDetailPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      <Route path="/lecturer" element={<RequireRole role="lecturer" layout={<LecturerLayout />} />}>
        <Route index element={<LecturerDashboard />} />
        <Route path="courses" element={<LecturerCoursesPage />} />
        <Route path="courses/:id" element={<LecturerCourseDetailPage />} />
        <Route path="attendance" element={<LecturerSessionsPage />} />
        <Route path="attendance/:id" element={<LecturerSessionDetailPage />} />
        <Route path="reports" element={<LecturerReportsPage />} />
      </Route>

      <Route path="/student" element={<RequireRole role="student" layout={<StudentLayout />} />}>
        <Route index element={<StudentDashboard />} />
        <Route path="courses" element={<StudentCoursesPage />} />
        <Route path="scan" element={<ScanPage />} />
        <Route path="attendance" element={<StudentAttendancePage />} />
        <Route path="profile" element={<StudentProfilePage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
