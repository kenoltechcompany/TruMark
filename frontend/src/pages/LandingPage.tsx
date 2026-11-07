import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  ScanFace,
  MapPin,
  Lock,
  ArrowRight,
  ShieldCheck,
  Smartphone,
  Globe,
  Users,
  QrCode,
  FileSpreadsheet,
} from 'lucide-react';

export default function LandingPage() {
  const navigate = useNavigate();
  const [sessionInput, setSessionInput] = useState('');

  const handleQuickCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionInput.trim()) return;
    navigate(`/check-in/${sessionInput.trim()}`);
  };

  return (
    <div className="min-h-screen bg-[#F6F8FA] text-[#1F2328] flex flex-col font-sans">
      {/* ── Top Navigation Bar ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#D0D7DE]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0969DA] flex items-center justify-center text-white font-bold text-base shadow-sm">
              T
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight text-[#1F2328] leading-none">
                TruMark
              </span>
              <span className="text-[10px] text-[#656D76] font-medium tracking-wide uppercase">
                Biometric Attendance
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/check-in"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium text-[#0969DA] hover:bg-[#F6F8FA] rounded-md transition-colors"
            >
              <Globe className="w-4 h-4" />
              <span>Web Check-In</span>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-[#0969DA] hover:bg-[#0353A4] rounded-md shadow-sm transition-colors"
            >
              <span>Portal Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <main className="flex-1">
        <section className="relative overflow-hidden py-14 sm:py-20 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#DDF4FF] border border-[#54AEFF]/40 text-[#0969DA] text-xs font-semibold rounded-full shadow-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Next-Gen Biometric & Offline Attendance System</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#1F2328] leading-[1.15]">
              Accurate, Geofenced Attendance <br className="hidden sm:inline" />
              <span className="text-[#0969DA]">Powered by Face Biometrics</span>
            </h1>

            <p className="max-w-2xl mx-auto text-base sm:text-lg text-[#656D76] leading-relaxed">
              TruMark replaces vulnerable sign-in sheets with edge facial verification,
              high-precision classroom GPS geofencing, and instant audit controls for modern institutions.
            </p>

            {/* Quick Session Check-In Input Form */}
            <div className="pt-2 max-w-md mx-auto">
              <form
                onSubmit={handleQuickCheckIn}
                className="flex flex-col sm:flex-row gap-2 bg-white p-2 border border-[#D0D7DE] rounded-xl shadow-md"
              >
                <input
                  type="text"
                  placeholder="Paste Session ID or scan code..."
                  value={sessionInput}
                  onChange={(e) => setSessionInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-transparent focus:outline-none text-[#1F2328]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1F883D] hover:bg-[#1A7F37] text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
                >
                  <ScanFace className="w-4 h-4" />
                  <span>Check In</span>
                </button>
              </form>
              <p className="text-xs text-[#656D76] mt-2">
                Have a session code from your course representative? Enter it above to mark attendance right now.
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="pt-4 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/check-in"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0969DA] text-white font-semibold text-sm rounded-lg hover:bg-[#0353A4] shadow-sm transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>Mark Attendance (Web)</span>
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#D0D7DE] text-[#1F2328] font-semibold text-sm rounded-lg hover:bg-[#F6F8FA] shadow-xs transition-colors"
              >
                <span>Institutional Portal</span>
                <ArrowRight className="w-4 h-4 text-[#656D76]" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Feature Grid ── */}
        <section className="py-12 bg-white border-y border-[#D0D7DE] px-4 sm:px-6">
          <div className="max-w-6xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-10">
              <h2 className="text-2xl font-bold text-[#1F2328]">
                Engineered for Academic Integrity
              </h2>
              <p className="text-sm text-[#656D76] mt-1">
                Every feature is purpose-built to prevent proxy attendance, buddy punching, and location spoofing.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="p-5 border border-[#D0D7DE] rounded-xl bg-[#F6F8FA]/50 hover:bg-white hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#DDF4FF] text-[#0969DA] flex items-center justify-center mb-3">
                  <ScanFace className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-[#1F2328] mb-1.5">
                  Edge Biometric Verification
                </h3>
                <p className="text-xs sm:text-sm text-[#656D76] leading-relaxed">
                  Deep facial embeddings extracted via InsightFace and ArcFace models. Fast, private, and capable of operating offline without continuous cloud dependency.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="p-5 border border-[#D0D7DE] rounded-xl bg-[#F6F8FA]/50 hover:bg-white hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#E6F6EC] text-[#1F883D] flex items-center justify-center mb-3">
                  <MapPin className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-[#1F2328] mb-1.5">
                  Classroom GPS Geofencing
                </h3>
                <p className="text-xs sm:text-sm text-[#656D76] leading-relaxed">
                  Real-time Haversine perimeter calculations ensure check-ins only succeed when students are inside the registered physical classroom boundary.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="p-5 border border-[#D0D7DE] rounded-xl bg-[#F6F8FA]/50 hover:bg-white hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#FFF8E5] text-[#9A6700] flex items-center justify-center mb-3">
                  <Lock className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-[#1F2328] mb-1.5">
                  Instant Attendance Padlock
                </h3>
                <p className="text-xs sm:text-sm text-[#656D76] leading-relaxed">
                  Course representatives can toggle attendance lock at any moment during lectures to immediately disable new check-ins with one click.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="p-5 border border-[#D0D7DE] rounded-xl bg-[#F6F8FA]/50 hover:bg-white hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#FBEFFF] text-[#8250DF] flex items-center justify-center mb-3">
                  <Globe className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-[#1F2328] mb-1.5">
                  Zero-Install Web Check-In
                </h3>
                <p className="text-xs sm:text-sm text-[#656D76] leading-relaxed">
                  Students without the mobile app can check in seamlessly from any smartphone browser using HTML5 camera capture and geolocation.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="p-5 border border-[#D0D7DE] rounded-xl bg-[#F6F8FA]/50 hover:bg-white hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#DDF4FF] text-[#0969DA] flex items-center justify-center mb-3">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-[#1F2328] mb-1.5">
                  Dual-Mode QR Broadcasting
                </h3>
                <p className="text-xs sm:text-sm text-[#656D76] leading-relaxed">
                  Project or print high-contrast SVG QR codes optimized for both camera-based Web attendance and offline mobile app tokens.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="p-5 border border-[#D0D7DE] rounded-xl bg-[#F6F8FA]/50 hover:bg-white hover:shadow-md transition-all">
                <div className="w-10 h-10 rounded-lg bg-[#E6F6EC] text-[#1F883D] flex items-center justify-center mb-3">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-[#1F2328] mb-1.5">
                  1-Click CSV Exports & Audits
                </h3>
                <p className="text-xs sm:text-sm text-[#656D76] leading-relaxed">
                  Instant attendance auditing, present vs absent breakdown, manual overrides for exceptional cases, and formatted CSV export for grading.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works Steps ── */}
        <section className="py-14 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-[#1F2328]">
                How TruMark Works
              </h2>
              <p className="text-sm text-[#656D76] mt-1">
                A simple 3-step workflow for students and lecturers.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 relative">
                <div className="text-2xl font-black text-[#0969DA]/20 mb-2">01</div>
                <h4 className="font-semibold text-sm text-[#1F2328] mb-1">
                  1. Self-Enrollment
                </h4>
                <p className="text-xs text-[#656D76]">
                  Students open their class link, enter their name and index number, and capture 3 reference angles via camera.
                </p>
              </div>

              <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 relative">
                <div className="text-2xl font-black text-[#0969DA]/20 mb-2">02</div>
                <h4 className="font-semibold text-sm text-[#1F2328] mb-1">
                  2. Session Broadcast
                </h4>
                <p className="text-xs text-[#656D76]">
                  The course rep creates a session for the scheduled room and projects the dynamic QR code on the lecture screen.
                </p>
              </div>

              <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 relative">
                <div className="text-2xl font-black text-[#0969DA]/20 mb-2">03</div>
                <h4 className="font-semibold text-sm text-[#1F2328] mb-1">
                  3. Verify & Confirm
                </h4>
                <p className="text-xs text-[#656D76]">
                  Students scan the QR code in browser or app. GPS and face matching verify physical presence in under 2 seconds.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-white border-t border-[#D0D7DE] py-8 px-4 sm:px-6 text-xs text-[#656D76]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-[#1F2328]">TruMark</span>
            <span>&middot;</span>
            <span>Secure Biometric Attendance Management</span>
          </div>

          <div className="flex items-center gap-4">
            <Link to="/check-in" className="hover:text-[#0969DA] transition-colors">
              Web Check-In
            </Link>
            <Link to="/login" className="hover:text-[#0969DA] transition-colors">
              Portal Sign In
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
