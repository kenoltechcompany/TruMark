import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, Calendar, ScanFace } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/course-rep-dashboard', label: 'Class Dashboard', end: true, icon: LayoutDashboard },
  { to: '/course-rep-dashboard/sessions', label: 'Sessions & Attendance', icon: Calendar },
];

export default function CourseRepDashboardLayout() {
  const { logout, username } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen neu-surface flex flex-col font-sans text-[#1F2328]">
      {/* ── Top Bar (Desktop & Mobile Header) ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#D0D7DE] px-4 sm:px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo-nav.png"
              alt="TruMark Class Attendance System"
              className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-[1.02]"
            />
          </Link>

          {/* Desktop Tactile Segmented Navigation */}
          <nav className="hidden md:flex items-center neu-track gap-1" aria-label="Course Rep navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `neu-tab inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold ${
                      isActive ? 'active text-[#1F2328]' : ''
                    }`
                  }
                >
                  <Icon className="w-3.5 h-3.5 text-[#0969DA]" />
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
            className="hidden sm:inline-flex neu-pill px-3 py-1.5 text-xs font-medium text-[#1F2328] hover:text-[#0969DA]"
          >
            <ScanFace className="w-3.5 h-3.5 text-[#1F883D]" />
            <span>Check-In View</span>
          </Link>

          {username && (
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#F6F8FA] border border-[#D0D7DE]">
              <img
                src="/brand-mark.png"
                alt="TruMark"
                className="w-5 h-5 object-contain"
              />
              <span className="text-xs font-medium text-[#1F2328]">@{username}</span>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#CF222E] bg-white border border-[#D0D7DE] hover:bg-[#FFEBE9] hover:border-[#FF8182] rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>

          {/* Mobile hamburger button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 text-[#656D76] hover:text-[#1F2328] rounded-lg border border-[#D0D7DE] bg-[#F6F8FA] cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* ── Mobile Drawer Backdrop ── */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/35 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* ── Mobile Slide-out Menu ── */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed top-14 inset-x-0 bg-white border-b border-[#D0D7DE] z-50 p-4 space-y-2 shadow-lg animate-enter">
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
                    `flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-[#EEF2F6] text-[#0969DA] font-semibold'
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
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-[#0969DA] hover:bg-[#F6F8FA]"
            >
              <ScanFace className="w-4 h-4 text-[#1F883D]" />
              <span>Open Check-In View</span>
            </Link>
          </nav>

          <div className="pt-2 border-t border-[#D0D7DE] flex items-center justify-between">
            {username && (
              <span className="text-xs font-medium text-[#656D76]">@{username}</span>
            )}
            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#CF222E] hover:bg-[#FFEBE9] rounded-lg"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
        <div key={location.pathname} className="animate-enter">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
