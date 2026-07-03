import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function CourseRepDashboardLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA]">
      {/* ── Top bar ── */}
      <header className="bg-white border-b border-[#D0D7DE] px-6 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-[#1F2328]">TruMark</h1>
          <p className="text-xs text-[#656D76] mt-0.5">Course Rep Dashboard</p>
        </div>
        <button
          onClick={handleLogout}
          className="text-sm text-[#656D76] hover:text-[#1F2328] transition-colors"
        >
          Log out
        </button>
      </header>

      {/* ── Content ── */}
      <main className="p-6 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
