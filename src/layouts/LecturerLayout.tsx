import { Outlet } from 'react-router-dom';
import { BarChart3, BookOpen, LayoutDashboard, QrCode } from 'lucide-react';
import { DashboardLayout } from '../components/DashboardLayout';
import type { NavItem } from '../components/DashboardLayout';

const nav: NavItem[] = [
  { to: '/lecturer', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/lecturer/courses', label: 'My Courses', icon: BookOpen },
  { to: '/lecturer/attendance', label: 'Attendance', icon: QrCode },
  { to: '/lecturer/reports', label: 'Reports', icon: BarChart3 },
];

export function LecturerLayout() {
  return (
    <DashboardLayout nav={nav} bottomNav={nav}>
      <Outlet />
    </DashboardLayout>
  );
}
