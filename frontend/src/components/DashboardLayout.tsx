import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/course-reps', label: 'Course Reps' },
  { to: '/classes', label: 'Classes' },
  { to: '/classrooms', label: 'Classrooms' },
  { to: '/global-roster', label: 'Global Roster Audit' },
];

export default function DashboardLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex">
      {/* ── Sidebar ── */}
      <aside className="w-56 bg-white border-r border-[#D0D7DE] flex flex-col">
        <div className="p-4 border-b border-[#D0D7DE]">
          <h1 className="text-lg font-semibold text-[#1F2328]">TruMark</h1>
          <p className="text-xs text-[#656D76] mt-0.5">Admin Dashboard</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#0969DA] text-white'
                    : 'text-[#1F2328] hover:bg-[#F6F8FA]'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-[#D0D7DE]">
          <button
            onClick={handleLogout}
            className="w-full text-left px-3 py-1.5 rounded-md text-sm text-[#656D76] hover:bg-[#F6F8FA] transition-colors"
          >
            Log out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
