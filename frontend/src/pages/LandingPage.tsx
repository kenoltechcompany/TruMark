import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ScanFace,
  MapPin,
  Lock,
  ArrowRight,
  Globe,
  QrCode,
  FileSpreadsheet,
  UserPlus,
  Radio,
  ShieldCheck,
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
      {/* ── Top Navigation Bar (Opaque minimalist header, no glass blur) ── */}
      <header className="sticky top-0 z-40 bg-white border-b border-[#D0D7DE]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo-nav.png"
              alt="TruMark Class Attendance System"
              className="h-9 sm:h-10 w-auto object-contain transition-transform group-hover:scale-[1.02]"
            />
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
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold text-white bg-[#0969DA] hover:bg-[#0353A4] rounded-md transition-colors"
            >
              <span>Portal Login</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <main className="flex-1">
        <section className="py-14 sm:py-20 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center space-y-6 animate-enter">
            {/* Plain left-bordered eyebrow text */}
            <div className="flex justify-center">
              <span className="border-l-2 border-[#0969DA] pl-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#656D76]">
                Federated Biometric &amp; Geofenced Attendance
              </span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-[#1F2328] leading-[1.15]">
              Accurate, Geofenced Attendance <br className="hidden sm:inline" />
              <span className="text-[#0969DA]">Verified by Face Biometrics</span>
            </h1>

            <p className="max-w-2xl mx-auto text-base sm:text-lg text-[#656D76] leading-relaxed">
              TruMark replaces paper sign-in sheets with facial recognition,
              classroom GPS geofencing, and live attendance auditing for academic institutions.
            </p>

            {/* Quick Session Check-In Input Form */}
            <div className="pt-2 max-w-md mx-auto animate-enter-delay-1">
              <form
                onSubmit={handleQuickCheckIn}
                className="flex flex-col sm:flex-row gap-2 bg-white p-1.5 border border-[#D0D7DE] rounded-xl shadow-xs focus-within:ring-2 focus-within:ring-[#0969DA] focus-within:border-[#0969DA] transition-shadow"
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
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-[#1F883D] hover:bg-[#1A7F37] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <ScanFace className="w-4 h-4" />
                  <span>Check In</span>
                </button>
              </form>
              <p className="text-xs text-[#656D76] mt-2">
                Have a session code from your course representative? Enter it above to mark attendance.
              </p>
            </div>

            {/* Main Action Buttons */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-3 animate-enter-delay-2">
              <Link
                to="/check-in"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0969DA] text-white font-semibold text-sm rounded-lg hover:bg-[#0353A4] transition-colors"
              >
                <Globe className="w-4 h-4" />
                <span>Mark Attendance (Web)</span>
              </Link>
              <Link
                to="/login"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-[#D0D7DE] text-[#1F2328] font-semibold text-sm rounded-lg hover:bg-[#F6F8FA] transition-colors"
              >
                <span>Institutional Portal</span>
                <ArrowRight className="w-4 h-4 text-[#656D76]" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── Architecture & Capabilities (Minimalist asymmetric layout) ── */}
        <section className="py-12 bg-white border-y border-[#D0D7DE] px-4 sm:px-6">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="max-w-xl">
              <span className="border-l-2 border-[#0969DA] pl-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#656D76]">
                System Architecture
              </span>
              <h2 className="text-2xl font-bold text-[#1F2328] mt-2">
                Built for Academic Integrity
              </h2>
              <p className="text-sm text-[#656D76] mt-1">
                Dual-factor verification prevents proxy attendance and location spoofing with commercial-grade biometric verification.
              </p>
            </div>

            {/* Primary 2-Column Pillars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 border border-[#D0D7DE] rounded-xl bg-[#F6F8FA]">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <ScanFace className="w-5 h-5 text-[#0969DA] shrink-0" />
                  <h3 className="text-base font-semibold text-[#1F2328]">
                    High-Precision Facial Biometrics
                  </h3>
                </div>
                <p className="text-sm text-[#656D76] leading-relaxed">
                  Powered by Face++ &amp; 512-dimensional ArcFace embeddings, TruMark verifies student identity in real time from a live selfie against enrolled 3-angle reference captures.
                </p>
              </div>

              <div className="p-6 border border-[#D0D7DE] rounded-xl bg-[#F6F8FA]">
                <div className="flex items-center gap-2.5 mb-2.5">
                  <MapPin className="w-5 h-5 text-[#1F883D] shrink-0" />
                  <h3 className="text-base font-semibold text-[#1F2328]">
                    Classroom GPS Geofencing
                  </h3>
                </div>
                <p className="text-sm text-[#656D76] leading-relaxed">
                  Real-time Haversine perimeter checks validate that every check-in originates inside the assigned lecture hall radius before biometric matching is recorded.
                </p>
              </div>
            </div>

            {/* Secondary 4-Item Compact Operational Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-2 border-t border-[#E1E4E8]">
              <div className="pt-3">
                <div className="flex items-center gap-2 mb-1">
                  <Lock className="w-4 h-4 text-[#1F2328]" />
                  <h4 className="text-sm font-semibold text-[#1F2328]">Instant Session Lock</h4>
                </div>
                <p className="text-xs text-[#656D76] leading-relaxed">
                  Course reps can lock active sessions with one click to stop late check-ins immediately.
                </p>
              </div>

              <div className="pt-3">
                <div className="flex items-center gap-2 mb-1">
                  <Globe className="w-4 h-4 text-[#0969DA]" />
                  <h4 className="text-sm font-semibold text-[#1F2328]">Zero-Install Web Check-In</h4>
                </div>
                <p className="text-xs text-[#656D76] leading-relaxed">
                  Students can verify attendance from any mobile browser using HTML5 camera and GPS.
                </p>
              </div>

              <div className="pt-3">
                <div className="flex items-center gap-2 mb-1">
                  <QrCode className="w-4 h-4 text-[#0969DA]" />
                  <h4 className="text-sm font-semibold text-[#1F2328]">Live QR Broadcasting</h4>
                </div>
                <p className="text-xs text-[#656D76] leading-relaxed">
                  High-contrast SVG QR codes project cleanly onto lecture screens for fast scanning.
                </p>
              </div>

              <div className="pt-3">
                <div className="flex items-center gap-2 mb-1">
                  <FileSpreadsheet className="w-4 h-4 text-[#1F883D]" />
                  <h4 className="text-sm font-semibold text-[#1F2328]">1-Click CSV Audits</h4>
                </div>
                <p className="text-xs text-[#656D76] leading-relaxed">
                  Live Present vs. Absent breakdowns, manual overrides, and department-ready CSV exports.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── How It Works (Selective Neumorphism: Raised Medallions on Debossed Track) ── */}
        <section className="neu-surface py-16 px-4 sm:px-6 border-b border-[#D0D7DE]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <span className="border-l-2 border-[#0969DA] pl-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#656D76]">
                Workflow
              </span>
              <h2 className="text-2xl font-bold text-[#1F2328] mt-2">
                How TruMark Works
              </h2>
              <p className="text-sm text-[#656D76] mt-1">
                Three steps from student enrollment to verified lecture attendance.
              </p>
            </div>

            <div className="relative">
              {/* Debossed horizontal progress track (desktop) */}
              <div
                aria-hidden="true"
                className="hidden sm:block absolute top-8 left-[16%] right-[16%] h-2.5 neu-inset rounded-full"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 relative">
                {/* Step 1 */}
                <div className="flex flex-col items-center text-center animate-enter">
                  <div className="w-16 h-16 neu-raised neu-raised--press flex items-center justify-center text-[#0969DA] mb-5 z-10">
                    <UserPlus className="w-6 h-6" />
                  </div>
                  <div className="neu-raised p-5 w-full flex-1 text-left">
                    <h3 className="font-semibold text-sm text-[#1F2328] mb-1.5">
                      Self-Enrollment
                    </h3>
                    <p className="text-xs text-[#656D76] leading-relaxed">
                      Students open their class registration link, enter their index number, and capture reference angles via camera.
                    </p>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex flex-col items-center text-center animate-enter-delay-1">
                  <div className="w-16 h-16 neu-raised neu-raised--press flex items-center justify-center text-[#0969DA] mb-5 z-10">
                    <Radio className="w-6 h-6" />
                  </div>
                  <div className="neu-raised p-5 w-full flex-1 text-left">
                    <h3 className="font-semibold text-sm text-[#1F2328] mb-1.5">
                      Session Broadcast
                    </h3>
                    <p className="text-xs text-[#656D76] leading-relaxed">
                      The course rep starts a session for the scheduled classroom and projects the dynamic QR code in class.
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex flex-col items-center text-center animate-enter-delay-2">
                  <div className="w-16 h-16 neu-raised neu-raised--press flex items-center justify-center text-[#1F883D] mb-5 z-10">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div className="neu-raised p-5 w-full flex-1 text-left">
                    <h3 className="font-semibold text-sm text-[#1F2328] mb-1.5">
                      Verify &amp; Confirm
                    </h3>
                    <p className="text-xs text-[#656D76] leading-relaxed">
                      Students scan the QR code in browser or mobile app. GPS geofencing and face matching confirm presence in under 2 seconds.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="bg-white py-8 px-4 sm:px-6 text-xs text-[#656D76]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/logo-nav.png"
              alt="TruMark"
              className="h-7 w-auto object-contain"
            />
            <span className="text-[#D0D7DE]">|</span>
            <span>Federated Biometric Attendance Management</span>
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
