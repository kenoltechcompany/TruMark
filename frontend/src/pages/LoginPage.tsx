import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  UserCheck,
  ScanFace,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

type PortalRoleHint = 'COURSE_REP' | 'ADMIN';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [roleHint, setRoleHint] = useState<PortalRoleHint>('COURSE_REP');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(username, password);
      const token = localStorage.getItem('token');
      if (token) {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.role === 'COURSE_REP') {
          navigate('/course-rep-dashboard');
        } else {
          navigate('/course-reps');
        }
      } else {
        navigate('/course-reps');
      }
    } catch {
      setError('Invalid username or password. Please check your credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen neu-surface flex flex-col justify-between px-4 py-6 sm:px-6 font-sans text-[#1F2328]">
      {/* ── Top Minimalist Return Bar ── */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#656D76] hover:text-[#1F2328] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to TruMark</span>
        </Link>

        <Link
          to="/check-in"
          className="neu-pill px-3 py-1 text-xs font-medium text-[#1F2328] hover:text-[#0969DA]"
        >
          <ScanFace className="w-3.5 h-3.5 text-[#1F883D]" />
          <span>Student Check-In</span>
        </Link>
      </div>

      {/* ── Centered Auth Card ── */}
      <div className="w-full max-w-md mx-auto my-auto py-8 animate-enter">
        {/* Seamless Transparent Brand Header (no box-on-box) */}
        <div className="flex flex-col items-center text-center mb-6">
          <Link to="/" className="mb-4 transition-transform hover:scale-[1.02]">
            <img
              src="/logo-nav.png"
              alt="TruMark Class Attendance System"
              className="h-16 sm:h-[72px] w-auto object-contain"
            />
          </Link>

          <span className="border-l-2 border-[#0969DA] pl-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#656D76]">
            Institutional Portal Sign-In
          </span>
          <p className="text-xs text-[#656D76] mt-1.5">
            {roleHint === 'COURSE_REP'
              ? 'Manage class sessions, live QR codes, and attendance rosters.'
              : 'Configure classrooms, course reps, and biometric policies.'}
          </p>
        </div>

        {/* Crisp Minimalist Card */}
        <div className="bg-white border border-[#D0D7DE] rounded-xl shadow-xs p-6 space-y-5">
          {/* Interactive Tactile Role Context Switcher */}
          <div
            role="tablist"
            aria-label="Account type"
            className="neu-track w-full grid grid-cols-2 gap-1 text-xs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={roleHint === 'COURSE_REP'}
              onClick={() => setRoleHint('COURSE_REP')}
              className={`neu-tab py-2 px-3 font-medium inline-flex items-center justify-center gap-1.5 ${
                roleHint === 'COURSE_REP' ? 'active text-[#1F2328]' : ''
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 text-[#0969DA]" />
              <span>Course Rep</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={roleHint === 'ADMIN'}
              onClick={() => setRoleHint('ADMIN')}
              className={`neu-tab py-2 px-3 font-medium inline-flex items-center justify-center gap-1.5 ${
                roleHint === 'ADMIN' ? 'active text-[#1F2328]' : ''
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#1F883D]" />
              <span>Administrator</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Field */}
            <div>
              <label
                htmlFor="login-username"
                className="block text-xs font-semibold text-[#1F2328] mb-1.5"
              >
                Username
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-[#656D76] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  placeholder={roleHint === 'COURSE_REP' ? 'e.g. kwame_rep' : 'e.g. admin'}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white border border-[#D0D7DE] rounded-lg pl-9 pr-3 py-2 text-sm text-[#1F2328] placeholder:text-[#656D76]/60 focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-[#0969DA] transition-shadow"
                  required
                />
              </div>
            </div>

            {/* Password Field with Show/Hide Toggle */}
            <div>
              <label
                htmlFor="login-password"
                className="block text-xs font-semibold text-[#1F2328] mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#656D76] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-[#D0D7DE] rounded-lg pl-9 pr-10 py-2 text-sm text-[#1F2328] placeholder:text-[#656D76]/60 focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-[#0969DA] transition-shadow"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#656D76] hover:text-[#1F2328] rounded transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error Alert */}
            {error && (
              <div
                role="alert"
                className="bg-[#FFEBE9] border border-[#FF8182] text-[#CF222E] px-3 py-2.5 rounded-lg text-xs font-medium flex items-start gap-2 animate-enter"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-[#0969DA] hover:bg-[#0353A4] active:scale-[0.99] text-white py-2.5 px-4 rounded-lg text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Bottom Helper */}
        <p className="text-center text-xs text-[#656D76] mt-5">
          Marking attendance as a student?{' '}
          <Link to="/check-in" className="text-[#0969DA] font-medium hover:underline">
            Go to Web Check-In
          </Link>
        </p>
      </div>

      {/* Subtle Footer */}
      <div className="text-center text-[11px] text-[#656D76]">
        TruMark Class Attendance System &middot; KENOL Tech
      </div>
    </div>
  );
}
