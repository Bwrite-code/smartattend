import { useState } from 'react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, MoreHorizontal, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../lib/cn';
import { useAuth } from '../context/AuthContext';
import { backendMode } from '../services';
import { initials } from '../lib/format';
import { Badge } from './ui';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** NavLink "end" — match only the exact path (used for index routes). */
  end?: boolean;
}

interface DashboardLayoutProps {
  nav: NavItem[];
  /** Items shown in the mobile bottom bar (max 5 — doc §81). */
  bottomNav: NavItem[];
  /** Extra links surfaced through a "More" sheet on mobile. */
  moreNav?: NavItem[];
  children: ReactNode;
}

export function DashboardLayout({ nav, bottomNav, moreNav, children }: DashboardLayoutProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const linkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition',
      isActive ? 'bg-indigo-500/20 text-white ring-1 ring-inset ring-indigo-400/30' : 'text-slate-300 hover:bg-white/5 hover:text-white'
    );

  const mobileLinkClasses = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex flex-col items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium rounded-xl transition',
      isActive ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-700'
    );

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
        <img src="/icon.svg" alt="" className="h-9 w-9 rounded-xl" />
        <div>
          <p className="text-sm font-bold leading-tight text-white">SmartAttend</p>
          <p className="text-xs text-slate-400">Attendance Monitoring</p>
        </div>
      </div>
      <nav className="nav-scroll flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {nav.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClasses}>
            <item.icon className="h-5 w-5 shrink-0" aria-hidden />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/30 text-xs font-bold text-indigo-200">
            {initials(profile?.fullName ?? 'U')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{profile?.fullName}</p>
            <p className="truncate text-xs capitalize text-slate-400">{profile?.role}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4.5 w-4.5 h-[18px] w-[18px]" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-slate-900 lg:block">{sidebar}</aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between bg-slate-900 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2.5">
          <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
          <div>
            <p className="text-sm font-bold leading-tight text-white">SmartAttend</p>
            <p className="text-[11px] capitalize leading-tight text-slate-400">{profile?.role} portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {backendMode === 'mock' && <Badge tone="amber">Demo</Badge>}
          <button
            onClick={handleSignOut}
            className="rounded-lg p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="lg:pl-64">
        <div className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 lg:pb-10 lg:pt-8">{children}</div>
      </main>

      {/* Mobile bottom navigation */}
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        aria-label="Primary"
      >
        <div className={cn('mx-auto grid max-w-md px-2 py-1.5', bottomNav.length === 5 ? 'grid-cols-5' : bottomNav.length === 4 ? 'grid-cols-4' : 'grid-cols-3')}>
          {bottomNav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={mobileLinkClasses}>
              <item.icon className="h-5 w-5" aria-hidden />
              <span className="truncate">{item.label}</span>
            </NavLink>
          ))}
          {moreNav && moreNav.length > 0 && (
            <button onClick={() => setMoreOpen(true)} className={mobileLinkClasses({ isActive: false })}>
              <MoreHorizontal className="h-5 w-5" aria-hidden />
              <span>More</span>
            </button>
          )}
        </div>
      </nav>

      {/* "More" sheet (mobile) */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMoreOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">All pages</h3>
              <button onClick={() => setMoreOpen(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[...nav].map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMoreOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium',
                      isActive ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-50 text-slate-700'
                    )
                  }
                >
                  <item.icon className="h-4.5 w-4.5 h-[18px] w-[18px]" aria-hidden />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
