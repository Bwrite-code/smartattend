import { Outlet } from 'react-router-dom';
import { BookOpen, History, LayoutDashboard, ScanLine, User } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import type { NavItem } from '../components/DashboardLayout';

const nav: NavItem[] = [
  { to: '/student', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/student/courses', label: 'Courses', icon: BookOpen },
  { to: '/student/attendance', label: 'History', icon: History },
  { to: '/student/profile', label: 'Profile', icon: User },
];

const bottomNav: NavItem[] = [
  { to: '/student', label: 'Home', icon: LayoutDashboard, end: true },
  { to: '/student/courses', label: 'Courses', icon: BookOpen },
  { to: '/student/scan', label: 'Scan', icon: ScanLine },
  { to: '/student/attendance', label: 'History', icon: History },
  { to: '/student/profile', label: 'Profile', icon: User },
];

export function StudentLayout() {
  return (
    <DashboardLayout nav={nav} bottomNav={bottomNav}>
      <Outlet />
    </DashboardLayout>
  );
}
