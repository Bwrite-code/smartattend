import { Outlet } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  CalendarRange,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Link2,
  BookOpen,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import type { NavItem } from '../components/DashboardLayout';

const nav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/students', label: 'Students', icon: GraduationCap },
  { to: '/admin/lecturers', label: 'Lecturers', icon: Users },
  { to: '/admin/departments', label: 'Departments', icon: Building2 },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/enrollments', label: 'Enrollments', icon: UserPlus },
  { to: '/admin/assignments', label: 'Assignments', icon: Link2 },
  { to: '/admin/sessions', label: 'Academic Sessions', icon: CalendarRange },
  { to: '/admin/attendance', label: 'Attendance', icon: ClipboardList },
  { to: '/admin/reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const bottomNav: NavItem[] = [
  { to: '/admin', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/admin/students', label: 'Students', icon: GraduationCap },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/attendance', label: 'Attendance', icon: ClipboardList },
];

export function AdminLayout() {
  return (
    <DashboardLayout nav={nav} bottomNav={bottomNav} moreNav={nav}>
      <Outlet />
    </DashboardLayout>
  );
}
