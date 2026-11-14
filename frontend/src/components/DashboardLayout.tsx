import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Menu,
  X,
  LogOut,
  Users,
  BookOpen,
  MapPin,
  Shield,
  UserCheck,
  Settings,
  ScanFace,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/course-reps', label: 'Course Reps', icon: UserCheck },
  { to: '/classes', label: 'Classes', icon: BookOpen },
  { to: '/classrooms', label: 'Classrooms', icon: MapPin },
  { to: '/all-students', label: 'All Students', icon: Users },
  { to: '/admins', label: 'Administrators', icon: Shield },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export default function DashboardLayout() {
  const { logout, username } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentPage =
    navItems.find((item) => location.pathname.startsWith(item.to))?.label || 'Dashboard';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen neu-surface flex flex-col md:flex-row font-sans text-[#1F2328]">
      {/* ── Mobile Top Header (hidden on md+) ── */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-[#D0D7DE] px-4 py-2.5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <img
            src="/logo-nav.png"
            alt="TruMark"
            className="h-8 w-auto object-contain"
          />
        </Link>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-[#656D76] hover:text-[#1F2328] rounded-lg border border-[#D0D7DE] bg-[#F6F8FA] focus:outline-none cursor-pointer"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* ── Mobile Drawer Backdrop ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/35 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop standard, mobile drawer) ── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#D0D7DE] flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-[#E1E4E8] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo-nav.png"
              alt="TruMark Class Attendance System"
              className="h-9 w-auto object-contain transition-transform group-hover:scale-[1.02]"
            />
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1 text-[#656D76] hover:text-[#1F2328]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 pt-4 pb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#656D76]">
            Admin Console
          </span>
        </div>

        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#EEF2F6] text-[#0969DA] font-semibold border border-white/60 shadow-[-3px_-3px_7px_rgba(255,255,255,0.85),3px_3px_7px_rgba(163,177,198,0.4)]'
                      : 'text-[#1F2328] hover:bg-[#F6F8FA] hover:translate-x-0.5'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-2.5">
                      <Icon
                        className={`w-4 h-4 shrink-0 transition-colors ${
                          isActive
                            ? 'text-[#0969DA]'
                            : 'text-[#656D76] group-hover:text-[#1F2328]'
                        }`}
                      />
                      <span>{item.label}</span>
                    </div>
                    {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#0969DA]" />}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile & Logout Footer */}
        <div className="p-3 border-t border-[#E1E4E8] space-y-2.5 bg-[#F6F8FA]/60">
          {username && (
            <div className="flex items-center gap-2.5 px-2 py-1.5">
              <div className="w-8 h-8 rounded-lg bg-white border border-[#D0D7DE] p-1 flex items-center justify-center shrink-0">
                <img
                  src="/brand-mark.png"
                  alt="TruMark Icon"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[#1F2328] truncate">@{username}</div>
                <div className="text-[10px] text-[#656D76]">System Administrator</div>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold text-[#CF222E] bg-white border border-[#D0D7DE] hover:bg-[#FFEBE9] hover:border-[#FF8182] transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Column ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop Context Top Bar */}
        <header className="hidden md:flex h-14 bg-white border-b border-[#D0D7DE] px-6 items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-2 text-xs text-[#656D76]">
            <span className="font-medium">Admin Console</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="font-semibold text-[#1F2328]">{currentPage}</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="neu-pill px-3 py-1 text-[11px] font-medium text-[#1F2328]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1F883D]" />
              <span>System Active</span>
            </span>

            <Link
              to="/check-in"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D0D7DE] bg-[#F6F8FA] hover:bg-white text-xs font-medium text-[#1F2328] transition-colors"
            >
              <ScanFace className="w-3.5 h-3.5 text-[#0969DA]" />
              <span>Check-In View</span>
            </Link>
          </div>
        </header>

        {/* Page Content with Subtle Route Transition */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto overflow-x-hidden">
          <div key={location.pathname} className="animate-enter">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
