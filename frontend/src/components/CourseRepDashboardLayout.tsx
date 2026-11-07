import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, Calendar, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/course-rep-dashboard', label: 'Class Dashboard', end: true, icon: LayoutDashboard },
  { to: '/course-rep-dashboard/sessions', label: 'Sessions & Attendance', icon: Calendar },
];

export default function CourseRepDashboardLayout() {
  const { logout, username } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col">
      {/* ── Top Bar (Desktop & Mobile Header) ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#D0D7DE] px-4 sm:px-6 py-2.5 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#0969DA] flex items-center justify-center text-white font-bold text-sm shadow-xs">
              T
            </div>
            <div>
              <h1 className="text-base font-semibold text-[#1F2328] leading-tight">TruMark</h1>
              <p className="text-[10px] text-[#656D76] uppercase tracking-wide font-medium">
                Course Representative
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#0969DA] text-white shadow-xs'
                        : 'text-[#1F2328] hover:bg-[#F6F8FA]'
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/check-in"
            target="_blank"
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#0969DA] bg-[#DDF4FF] border border-[#54AEFF]/30 rounded-md hover:bg-[#B6E3FF] transition-colors"
          >
            <Globe className="w-3 h-3" />
            <span>Web Check-In</span>
          </Link>

          <button
            onClick={handleLogout}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#CF222E] hover:bg-[#FFEBE9] rounded-md transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Log out</span>
          </button>

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-[#656D76] hover:text-[#1F2328] rounded-md border border-[#D0D7DE]"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ── Mobile Drawer Backdrop ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Mobile Slide-out Menu ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-14 inset-x-0 bg-white border-b border-[#D0D7DE] z-50 p-4 space-y-2 shadow-lg animate-in slide-in-from-top duration-150">
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#0969DA] text-white'
                        : 'text-[#1F2328] hover:bg-[#F6F8FA]'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <Link
              to="/check-in"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-[#0969DA] hover:bg-[#DDF4FF]"
            >
              <Globe className="w-4 h-4" />
              <span>Open Web Check-In</span>
            </Link>
          </nav>

          <div className="pt-2 border-t border-[#D0D7DE] flex items-center justify-between">
            {username && (
              <span className="text-xs text-[#656D76]">@{username}</span>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-xs text-[#CF222E] font-medium"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Content ── */}
      <main className="flex-1 p-4 sm:p-6 max-w-5xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
