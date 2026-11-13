import { useState } from 'react';
import { Outlet, NavLink, useNavigate, Link } from 'react-router-dom';
import { Menu, X, LogOut, LayoutDashboard, Calendar, Globe, ChevronLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/course-rep-dashboard', label: 'Class Dashboard', end: true, icon: LayoutDashboard },
  { to: '/course-rep-dashboard/sessions', label: 'Sessions & Attendance', icon: Calendar },
];

export default function CourseRepDashboardLayout() {
  const { logout, username } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col md:flex-row">
      {/* Mobile Top Header (hidden on md+) */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-[#D0D7DE] px-4 py-3 flex items-center justify-between shadow-xs">
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

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-[#656D76] hover:text-[#1F2328] rounded-md border border-[#D0D7DE] focus:outline-none"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Collapsible Sidebar (Desktop) & Slide-in Drawer (Mobile) */}
      <aside
        className={`fixed md:sticky top-0 inset-y-0 left-0 z-50 h-screen bg-white border-r border-[#D0D7DE] flex flex-col transition-all duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'
        } ${sidebarCollapsed ? 'md:w-16' : 'md:w-64'}`}
      >
        {/* Sidebar Brand + Hamburger/Collapse Toggle */}
        <div
          className={`p-3.5 border-b border-[#D0D7DE] flex items-center ${
            sidebarCollapsed ? 'md:justify-center' : 'justify-between'
          }`}
        >
          {!sidebarCollapsed && (
            <Link to="/" className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#0969DA] flex items-center justify-center text-white font-bold text-sm shadow-xs shrink-0">
                T
              </div>
              <div className="truncate">
                <h1 className="text-base font-semibold text-[#1F2328] leading-tight truncate">
                  TruMark
                </h1>
                <p className="text-[10px] text-[#656D76] uppercase tracking-wide font-medium truncate">
                  Course Rep
                </p>
              </div>
            </Link>
          )}

          {/* Desktop collapse-to-hamburger button */}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden md:inline-flex p-1.5 text-[#656D76] hover:text-[#1F2328] hover:bg-[#F6F8FA] rounded-md transition-colors"
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {sidebarCollapsed ? <Menu className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-1 text-[#656D76] hover:text-[#1F2328]"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setMobileMenuOpen(false)}
                title={sidebarCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    sidebarCollapsed ? 'md:justify-center md:px-0' : ''
                  } ${
                    isActive
                      ? 'bg-[#0969DA] text-white shadow-xs'
                      : 'text-[#1F2328] hover:bg-[#F6F8FA]'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
              </NavLink>
            );
          })}

          <div className="pt-2 mt-2 border-t border-[#E1E4E8]">
            <Link
              to="/check-in"
              target="_blank"
              onClick={() => setMobileMenuOpen(false)}
              title={sidebarCollapsed ? 'Web Check-In' : undefined}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium text-[#0969DA] hover:bg-[#DDF4FF] transition-colors ${
                sidebarCollapsed ? 'md:justify-center md:px-0' : ''
              }`}
            >
              <Globe className="w-4 h-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">Web Check-In</span>}
            </Link>
          </div>
        </nav>

        {/* Bottom User & Logout */}
        <div className="p-3 border-t border-[#D0D7DE] space-y-2">
          {username && !sidebarCollapsed && (
            <div className="px-2 py-1 text-xs text-[#656D76] truncate">
              Signed in as <span className="font-semibold text-[#1F2328]">@{username}</span>
            </div>
          )}
          <button
            onClick={handleLogout}
            title={sidebarCollapsed ? 'Log out' : undefined}
            className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#CF222E] hover:bg-[#FFEBE9] rounded-md transition-colors ${
              sidebarCollapsed ? 'md:justify-center md:px-0' : ''
            }`}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!sidebarCollapsed && <span>Log out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 sm:p-6 min-w-0">
        <div className="max-w-6xl mx-auto w-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
