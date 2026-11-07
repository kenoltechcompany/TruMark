import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { Menu, X, LogOut, Users, BookOpen, MapPin, Shield, UserCheck, Settings } from 'lucide-react';
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col md:flex-row">
      {/* ── Mobile Top Header (hidden on md+) ── */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-[#D0D7DE] px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-[#0969DA] flex items-center justify-center text-white font-bold text-sm">
            T
          </div>
          <div>
            <h1 className="text-base font-semibold text-[#1F2328] leading-tight">TruMark</h1>
            <p className="text-[10px] text-[#656D76] uppercase tracking-wide font-medium">
              Admin Portal
            </p>
          </div>
        </Link>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-[#656D76] hover:text-[#1F2328] rounded-md border border-[#D0D7DE] focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* ── Mobile Drawer Backdrop ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop standard, mobile drawer) ── */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-[#D0D7DE] flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-4 border-b border-[#D0D7DE] flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0969DA] flex items-center justify-center text-white font-bold text-sm shadow-xs">
              T
            </div>
            <div>
              <h1 className="text-base font-semibold text-[#1F2328] leading-tight">TruMark</h1>
              <p className="text-[11px] text-[#656D76]">Admin Console</p>
            </div>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1 text-[#656D76] hover:text-[#1F2328]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#0969DA] text-white shadow-xs'
                      : 'text-[#1F2328] hover:bg-[#F6F8FA]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-[#D0D7DE] space-y-2">
          {username && (
            <div className="px-3 py-1 text-xs text-[#656D76]">
              Signed in as <span className="font-semibold text-[#1F2328]">@{username}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[#CF222E] hover:bg-[#FFEBE9] font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
