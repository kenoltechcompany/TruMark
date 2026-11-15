import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  QrCode,
  MapPin,
  Camera,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Clock,
  AlertCircle,
  RefreshCw,
  Zap,
  Hash,
  Crosshair,
} from 'lucide-react';
import apiClient from '../../api/client';

interface SessionData {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  className: string;
  classroomName: string;
  classroomBoundaries: {
    gpsLatitude: number;
    gpsLongitude: number;
    radiusMeters: number;
  };
  isLocked?: boolean;
  isActive: boolean;
  enableBiometricValidation?: boolean;
  enableGeofencing?: boolean;
}

interface CheckInResult {
  message: string;
  student: {
    id: string;
    fullName: string;
    indexNumber: string;
  };
  confidence: number;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function PublicCheckInPage() {
  const { sessionId: paramSessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();

  const [inputSessionId, setInputSessionId] = useState(paramSessionId || '');
  const [session, setSession] = useState<SessionData | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState('');

  // Hardware states
  const [coords, setCoords] = useState<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'acquiring' | 'ready' | 'denied' | 'error'>('idle');
  const [locationError, setLocationError] = useState('');

  const [cameraStatus, setCameraStatus] = useState<'idle' | 'ready' | 'denied' | 'error'>('idle');
  const [cameraError, setCameraError] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [indexNumber, setIndexNumber] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Fetch session details
  const fetchSession = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setIsLoadingSession(true);
    setSessionError('');
    setCheckInResult(null);
    setSubmitError('');

    try {
      const res = await apiClient.get<SessionData>(`/public/sessions/${id.trim()}`);
      setSession(res.data);
    } catch (err: any) {
      setSession(null);
      setSessionError(err.response?.data?.message || 'Session not found or invalid.');
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  useEffect(() => {
    if (paramSessionId) {
      setInputSessionId(paramSessionId);
      fetchSession(paramSessionId);
    }
  }, [paramSessionId, fetchSession]);

  // Determine policy flags
  const isBiometricActive = session?.enableBiometricValidation !== false;
  const isGeofenceActive = session?.enableGeofencing !== false;

  // Start Geolocation
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationStatus('error');
      setLocationError('Geolocation is not supported by your browser.');
      return;
    }

    setLocationStatus('acquiring');
    setLocationError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy),
        });
        setLocationStatus('ready');
      },
      (err) => {
        setLocationStatus('denied');
        if (err.code === err.PERMISSION_DENIED) {
          setLocationError('Location permission denied. Enable GPS access in browser settings.');
        } else {
          setLocationError(`Failed to get location: ${err.message}`);
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }, []);

  // Start Camera
  const startCamera = useCallback(async () => {
    try {
      setCameraError('');
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;
      setCameraStatus('ready');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
    } catch {
      setCameraStatus('denied');
      setCameraError('Camera access denied or unavailable. Please grant webcam permissions.');
    }
  }, []);

  // Auto-request location and camera when an active session is loaded
  useEffect(() => {
    if (session && session.isActive) {
      if (isGeofenceActive) {
        requestLocation();
      }
      if (isBiometricActive) {
        startCamera();
      }
    }
  }, [session, isGeofenceActive, isBiometricActive, requestLocation, startCamera]);

  // Attach video stream if camera is ready
  useEffect(() => {
    if (cameraStatus === 'ready' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStatus]);

  // Stop camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Haversine Distance Calculation
  let distanceToClassroom: number | null = null;
  let isWithinGeofence = false;
  if (coords && session?.classroomBoundaries) {
    distanceToClassroom = haversineDistance(
      coords.latitude,
      coords.longitude,
      session.classroomBoundaries.gpsLatitude,
      session.classroomBoundaries.gpsLongitude,
    );
    // 5m grace drift
    isWithinGeofence = distanceToClassroom <= session.classroomBoundaries.radiusMeters + 5;
  }

  // Capture & Check-In
  const handleCaptureAndCheckIn = async () => {
    if (!session || !session.isActive) {
      setSubmitError('This session is not currently active for attendance.');
      return;
    }

    if (isGeofenceActive) {
      if (!coords) {
        setSubmitError('Location is required. Please grant GPS permissions.');
        return;
      }
      if (!isWithinGeofence) {
        setSubmitError(
          `Outside classroom boundary. You are ${Math.round(distanceToClassroom ?? 0)}m away (max ${
            session.classroomBoundaries.radiusMeters + 5
          }m).`,
        );
        return;
      }
    }

    if (isBiometricActive) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || cameraStatus !== 'ready') {
        setSubmitError('Camera preview is not ready. Please allow camera access.');
        return;
      }
    } else {
      if (!indexNumber.trim()) {
        setSubmitError('Please enter your student index number to check in.');
        return;
      }
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const formData = new FormData();
      if (coords) {
        formData.append('latitude', String(coords.latitude));
        formData.append('longitude', String(coords.longitude));
      }
      if (indexNumber.trim()) {
        formData.append('indexNumber', indexNumber.trim());
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && cameraStatus === 'ready') {
        const rawW = video.videoWidth || 640;
        const rawH = video.videoHeight || 480;
        const scale = Math.min(1, 640 / Math.max(rawW, rawH));
        canvas.width = Math.round(rawW * scale);
        canvas.height = Math.round(rawH * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.82),
          );
          if (blob) {
            formData.append('image', blob, 'web-checkin.jpg');
          }
        }
      }

      const res = await apiClient.post<CheckInResult>(
        `/public/sessions/${session.id}/check-in`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        },
      );

      setCheckInResult(res.data);
      // Stop camera once verified
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    } catch (err: any) {
      setSubmitError(
        err.response?.data?.message || err.message || 'Attendance verification failed. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleManualSessionLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputSessionId.trim()) {
      navigate(`/check-in/${inputSessionId.trim()}`);
      fetchSession(inputSessionId.trim());
    }
  };

  const isActiveSessionView = Boolean(session && !checkInResult);

  return (
    <div className="min-h-screen neu-surface flex flex-col justify-between text-[#1F2328] font-sans">
      {/* ── Top Header ── */}
      <header className="bg-white border-b border-[#D0D7DE] py-3 px-4 sm:px-6 sticky top-0 z-30">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <img
              src="/logo-nav.png"
              alt="TruMark Class Attendance System"
              className="h-8 sm:h-9 w-auto object-contain transition-transform group-hover:scale-[1.02]"
            />
          </Link>

          <div className="flex items-center gap-2">
            <span className="neu-pill px-2.5 sm:px-3 py-1 text-[11px] font-medium text-[#1F2328]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1F883D]" />
              <span className="hidden sm:inline">Biometric &amp; GPS Portal</span>
              <span className="sm:hidden">Live Portal</span>
            </span>
            <Link
              to="/login"
              className="text-xs font-medium text-[#656D76] hover:text-[#0969DA] transition-colors px-2 py-1"
            >
              Staff Login
            </Link>
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main
        className={`w-full mx-auto px-3.5 sm:px-6 py-4 sm:py-6 my-auto ${
          isActiveSessionView ? 'max-w-5xl' : 'max-w-2xl'
        }`}
      >
        {/* 1. Session Lookup View */}
        {!session && !isLoadingSession && (
          <div className="space-y-6 animate-enter">
            {/* Tactile Medallion Header */}
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 neu-raised neu-raised--press flex items-center justify-center text-[#0969DA] mb-4">
                <QrCode className="w-7 h-7" />
              </div>
              <span className="border-l-2 border-[#0969DA] pl-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#656D76]">
                Student Check-In
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1F2328] mt-1.5">
                Join Active Class Session
              </h2>
              <p className="text-xs sm:text-sm text-[#656D76] mt-1 max-w-md">
                Enter the Session ID displayed on your lecturer&apos;s screen or scan the session QR code to begin verification.
              </p>
            </div>

            {/* Minimalist Lookup Card */}
            <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 sm:p-6 shadow-xs">
              {sessionError && (
                <div
                  role="alert"
                  className="bg-[#FFEBE9] border border-[#FF8182] text-[#CF222E] px-3.5 py-2.5 rounded-lg text-xs font-medium mb-4 flex items-center gap-2 animate-enter"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{sessionError}</span>
                </div>
              )}

              <form onSubmit={handleManualSessionLookup} className="space-y-4">
                <div>
                  <label
                    htmlFor="session-id-input"
                    className="block text-xs font-semibold text-[#1F2328] mb-1.5"
                  >
                    Session ID / Token
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-[#656D76] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="session-id-input"
                      type="text"
                      placeholder="e.g. bfea1f11-5d9f-48f3-9a00-5c63feca4531"
                      value={inputSessionId}
                      onChange={(e) => setInputSessionId(e.target.value)}
                      className="w-full bg-white border border-[#D0D7DE] rounded-lg pl-9 pr-3.5 py-2.5 text-sm text-[#1F2328] placeholder:text-[#656D76]/60 focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-[#0969DA] transition-shadow"
                      required
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#0969DA] hover:bg-[#0353A4] active:scale-[0.99] text-white py-2.5 px-4 rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Find Session</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>

            {/* 3-Step Verification Preview Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 animate-enter-delay-1">
              <div className="neu-raised neu-raised--press p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA] shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#1F2328]">GPS Geofence</div>
                  <div className="text-[11px] text-[#656D76]">Classroom proximity</div>
                </div>
              </div>

              <div className="neu-raised neu-raised--press p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA] shrink-0">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#1F2328]">Live Selfie</div>
                  <div className="text-[11px] text-[#656D76]">Face++ biometric match</div>
                </div>
              </div>

              <div className="neu-raised neu-raised--press p-3.5 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white border border-[#D0D7DE] flex items-center justify-center text-[#1F883D] shrink-0">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-[#1F2328]">Instant Record</div>
                  <div className="text-[11px] text-[#656D76]">Verified in &lt; 2s</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Loading Session */}
        {isLoadingSession && (
          <div className="bg-white border border-[#D0D7DE] rounded-xl p-10 sm:p-12 text-center shadow-xs animate-enter">
            <div className="inline-flex items-center justify-center w-12 h-12 neu-raised mb-4">
              <RefreshCw className="w-5 h-5 text-[#0969DA] animate-spin" />
            </div>
            <p className="text-sm font-semibold text-[#1F2328]">Connecting to Session...</p>
            <p className="text-xs text-[#656D76] mt-1">Fetching classroom boundaries and verification rules</p>
          </div>
        )}

        {/* 3. Active Session Check-In Console (Mobile-First Above-the-Fold Camera + Desktop 2-Column) */}
        {session && !checkInResult && (
          <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-12 lg:gap-5 items-start animate-enter">
            {/* ── Compact Mobile Session Header & Sensor Status Bar (visible on < lg above camera) ── */}
            <div className="lg:hidden space-y-2.5">
              <div className="bg-white border border-[#D0D7DE] rounded-xl p-3.5 shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="border-l-2 border-[#0969DA] pl-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#656D76]">
                      {session.className}
                    </span>
                    <h2 className="text-sm font-bold text-[#1F2328] truncate mt-0.5">
                      {session.name}
                    </h2>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        session.isActive
                          ? 'bg-[#E6F6EC] text-[#1F883D] border border-[#34D058]/60'
                          : 'bg-[#FFEBE9] text-[#CF222E] border border-[#FF8182]'
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          session.isActive ? 'bg-[#1F883D] animate-pulse' : 'bg-[#CF222E]'
                        }`}
                      />
                      {session.isActive ? 'Live' : 'Closed'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setSession(null);
                        setInputSessionId('');
                        navigate('/check-in');
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#656D76] px-2 py-1 rounded-md border border-[#D0D7DE] bg-[#F6F8FA] cursor-pointer"
                    >
                      <ArrowLeft className="w-3 h-3" />
                      <span>Change</span>
                    </button>
                  </div>
                </div>

                {/* Compact Mobile Sensor Pills */}
                <div className="mt-2.5 pt-2.5 border-t border-[#E1E4E8] grid grid-cols-2 gap-2">
                  {/* Mobile GPS Pill */}
                  <button
                    type="button"
                    onClick={isGeofenceActive ? requestLocation : undefined}
                    className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-left text-[11px] ${
                      !isGeofenceActive || (locationStatus === 'ready' && isWithinGeofence)
                        ? 'bg-[#E6F6EC]/60 border-[#34D058]/60 text-[#1F883D]'
                        : locationStatus === 'ready' && !isWithinGeofence
                        ? 'bg-[#FFEBE9]/70 border-[#FF8182] text-[#CF222E]'
                        : 'bg-[#F6F8FA] border-[#D0D7DE] text-[#1F2328]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold truncate">
                        {!isGeofenceActive
                          ? 'GPS Bypassed'
                          : locationStatus === 'acquiring'
                          ? 'Locating...'
                          : locationStatus === 'ready'
                          ? isWithinGeofence
                            ? `In Bounds (${Math.round(distanceToClassroom ?? 0)}m)`
                            : `${Math.round(distanceToClassroom ?? 0)}m Away`
                          : 'Tap for GPS'}
                      </span>
                    </div>
                    {isGeofenceActive && (
                      <Crosshair className={`w-3 h-3 shrink-0 ${locationStatus === 'acquiring' ? 'animate-spin' : ''}`} />
                    )}
                  </button>

                  {/* Mobile Camera Pill */}
                  <button
                    type="button"
                    onClick={isBiometricActive && cameraStatus !== 'ready' ? startCamera : undefined}
                    className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg border text-left text-[11px] ${
                      !isBiometricActive || cameraStatus === 'ready'
                        ? 'bg-[#E6F6EC]/60 border-[#34D058]/60 text-[#1F883D]'
                        : cameraStatus === 'denied'
                        ? 'bg-[#FFEBE9]/70 border-[#FF8182] text-[#CF222E]'
                        : 'bg-[#F6F8FA] border-[#D0D7DE] text-[#1F2328]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Camera className="w-3.5 h-3.5 shrink-0" />
                      <span className="font-semibold truncate">
                        {!isBiometricActive
                          ? 'Index Mode'
                          : cameraStatus === 'ready'
                          ? 'Camera Ready'
                          : 'Enable Camera'}
                      </span>
                    </div>
                  </button>
                </div>
              </div>

              {/* Error Alert on Mobile right above camera */}
              {submitError && (
                <div
                  role="alert"
                  className="bg-[#FFEBE9] border border-[#FF8182] text-[#CF222E] p-3 rounded-xl text-xs font-medium flex items-start gap-2 animate-enter"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>

            {/* ── Right Column on Desktop / First Interactive Card on Mobile: Biometric Viewfinder & Shutter ── */}
            <div className="lg:col-span-7 lg:order-2">
              <div className="bg-white border border-[#D0D7DE] rounded-xl p-3.5 sm:p-5 shadow-xs">
                {/* Top HUD Bar */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        cameraStatus === 'ready' ? 'bg-[#1F883D] animate-pulse' : 'bg-[#656D76]'
                      }`}
                    />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#1F2328]">
                      Biometric Viewfinder
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#656D76] bg-[#F6F8FA] border border-[#D0D7DE] px-2.5 py-0.5 rounded-md">
<span>Center face in oval</span>
                  </span>
                </div>

                {/* Video Viewport (Portrait 3:4 on mobile phones, 4:3 on tablet/desktop) */}
                <div className="relative w-full aspect-[3/4] sm:aspect-[4/3] max-h-[58vh] sm:max-h-none bg-[#0D1117] rounded-xl overflow-hidden border border-[#1F2328] flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Corner Viewfinder Brackets */}
                  {isBiometricActive && cameraStatus === 'ready' && (
                    <div className="absolute inset-3 sm:inset-4 pointer-events-none">
                      <div className="absolute top-0 left-0 w-5 h-5 sm:w-6 sm:h-6 border-t-2 border-l-2 border-white/70 rounded-tl" />
                      <div className="absolute top-0 right-0 w-5 h-5 sm:w-6 sm:h-6 border-t-2 border-r-2 border-white/70 rounded-tr" />
                      <div className="absolute bottom-0 left-0 w-5 h-5 sm:w-6 sm:h-6 border-b-2 border-l-2 border-white/70 rounded-bl" />
                      <div className="absolute bottom-0 right-0 w-5 h-5 sm:w-6 sm:h-6 border-b-2 border-r-2 border-white/70 rounded-br" />
                    </div>
                  )}

                  {/* Biometric Face Alignment Overlay + Scan Line */}
                  {isBiometricActive && (
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div
                        className={`relative w-40 h-52 sm:w-48 sm:h-64 border-2 border-dashed rounded-full transition-colors flex items-center justify-center overflow-hidden ${
                          !isGeofenceActive || isWithinGeofence ? 'border-[#34D058]' : 'border-[#FF8182]'
                        }`}
                        style={{ opacity: 0.9 }}
                      >
                        {cameraStatus === 'ready' && (
                          <div className="w-36 sm:w-40 h-0.5 bg-[#34D058]/85 rounded-full animate-scan-line" />
                        )}
                      </div>
                    </div>
                  )}

                  {cameraStatus !== 'ready' && isBiometricActive && (
                    <div className="absolute inset-0 bg-[#0D1117]/90 flex flex-col items-center justify-center p-6 text-center text-white">
                      <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3">
                        <Camera className="w-6 h-6 text-white" />
                      </div>
                      <p className="text-sm font-semibold mb-1">Camera Access Required</p>
                      <p className="text-xs text-white/70 mb-4 max-w-xs">
                        Position your face inside the alignment guide to verify your attendance.
                      </p>
                      <button
                        type="button"
                        onClick={startCamera}
                        className="bg-[#0969DA] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors cursor-pointer"
                      >
                        Grant Camera Permission
                      </button>
                    </div>
                  )}
                </div>

                {/* Tactile Neumorphic Shutter Bar */}
                <div className="mt-3.5 sm:mt-4">
                  {isBiometricActive ? (
                    <div className="neu-surface border border-[#D0D7DE] rounded-xl p-3.5 sm:px-5 flex items-center justify-between gap-3">
                      <div className="text-left min-w-0">
                        <div className="text-xs font-bold text-[#1F2328]">
                          {isSubmitting
                            ? 'Matching Face Biometrics...'
                            : isGeofenceActive && !isWithinGeofence
                            ? 'Move Inside Classroom Boundary'
                            : 'Ready to Verify Attendance'}
                        </div>
                        <div className="text-[11px] text-[#656D76] mt-0.5">
                          {isGeofenceActive && !isWithinGeofence && coords
                            ? `${Math.round(distanceToClassroom ?? 0)}m away from ${session.classroomName} (max ${
                                session.classroomBoundaries.radiusMeters + 5
                              }m)`
                            : 'Tap the green shutter button to verify'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleCaptureAndCheckIn}
                        disabled={
                          isSubmitting ||
                          !session.isActive ||
                          (isGeofenceActive && (locationStatus !== 'ready' || !isWithinGeofence)) ||
                          cameraStatus !== 'ready'
                        }
                        aria-label="Capture selfie and mark attendance"
                        className="neu-shutter shrink-0"
                      >
                        {isSubmitting ? (
                          <div className="w-6 h-6 border-2 border-[#0969DA] border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[#1F883D] flex items-center justify-center text-white shadow-xs transition-transform">
                            <Camera className="w-5 h-5" />
                          </div>
                        )}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCaptureAndCheckIn}
                      disabled={
                        isSubmitting ||
                        !session.isActive ||
                        (isGeofenceActive && (locationStatus !== 'ready' || !isWithinGeofence)) ||
                        !indexNumber.trim()
                      }
                      className="w-full bg-[#1F883D] text-white py-3 px-4 rounded-lg text-sm font-bold hover:bg-[#1A7F37] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Recording Attendance...</span>
                        </>
                      ) : (
                        <span>Mark Attendance</span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Left Column on Desktop: Full Session Context & Detailed Telemetry Gauges ── */}
            <div className="lg:col-span-5 lg:order-1 space-y-4">
              {/* Session Header Card (Desktop) */}
              <div className="hidden lg:block bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-xs">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="border-l-2 border-[#0969DA] pl-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#656D76]">
                      {session.className}
                    </span>
                    <h2 className="text-lg font-bold text-[#1F2328] mt-1 leading-snug">
                      {session.name}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSession(null);
                      setInputSessionId('');
                      navigate('/check-in');
                    }}
                    className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-[#656D76] hover:text-[#1F2328] px-2.5 py-1.5 rounded-lg border border-[#D0D7DE] bg-[#F6F8FA] hover:bg-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3 h-3" />
                    <span>Change</span>
                  </button>
                </div>

                {/* Metadata & Live Status Bar */}
                <div className="mt-4 pt-3.5 border-t border-[#E1E4E8] flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-[#656D76]">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#1F2328]">
                      <MapPin className="w-3.5 h-3.5 text-[#0969DA]" />
                      {session.classroomName}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      Ends {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${
                      session.isActive
                        ? 'bg-[#E6F6EC] text-[#1F883D] border border-[#34D058]/60'
                        : 'bg-[#FFEBE9] text-[#CF222E] border border-[#FF8182]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        session.isActive ? 'bg-[#1F883D] animate-pulse' : 'bg-[#CF222E]'
                      }`}
                    />
                    {session.isActive ? 'Live Session' : 'Closed'}
                  </span>
                </div>
              </div>

              {/* Tactile Hardware Telemetry Gauges */}
              <div className="space-y-3">
                {/* 1. GPS Geofence Tactile Tile */}
                <div className="neu-raised p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-lg bg-white border flex items-center justify-center shrink-0 ${
                          !isGeofenceActive || (locationStatus === 'ready' && isWithinGeofence)
                            ? 'border-[#34D058] text-[#1F883D]'
                            : locationStatus === 'ready' && !isWithinGeofence
                            ? 'border-[#FF8182] text-[#CF222E]'
                            : 'border-[#D0D7DE] text-[#0969DA]'
                        }`}
                      >
                        <MapPin className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1F2328]">GPS Geofence</div>
                        <div className="text-[11px] text-[#656D76]">
                          Allowed radius: {session.classroomBoundaries.radiusMeters + 5}m
                        </div>
                      </div>
                    </div>

                    {/* Status Badge */}
                    {!isGeofenceActive ? (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white border border-[#D0D7DE] text-[#1F883D]">
                        Bypassed
                      </span>
                    ) : locationStatus === 'acquiring' ? (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#DDF4FF] text-[#0969DA] animate-pulse">
                        Locating...
                      </span>
                    ) : locationStatus === 'ready' ? (
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          isWithinGeofence
                            ? 'bg-[#E6F6EC] text-[#1F883D] border-[#34D058]/60'
                            : 'bg-[#FFEBE9] text-[#CF222E] border-[#FF8182]'
                        }`}
                      >
                        {isWithinGeofence ? 'In Bounds' : 'Out of Range'}
                      </span>
                    ) : (
                      <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white border border-[#D0D7DE] text-[#656D76]">
                        Required
                      </span>
                    )}
                  </div>

                  {/* Readout & Refresh Action */}
                  <div className="mt-3 pt-2.5 border-t border-[#D0D7DE]/70 flex items-center justify-between gap-2 text-xs">
                    <div className="text-[11px]">
                      {!isGeofenceActive ? (
                        <span className="text-[#656D76]">Geofencing validation is bypassed for this session.</span>
                      ) : locationStatus === 'ready' ? (
                        isWithinGeofence ? (
                          <span className="text-[#1F883D] font-medium">
                            {Math.round(distanceToClassroom ?? 0)}m from center (&plusmn;{coords?.accuracy}m)
                          </span>
                        ) : (
                          <span className="text-[#CF222E] font-medium">
                            {Math.round(distanceToClassroom ?? 0)}m away (Max {session.classroomBoundaries.radiusMeters + 5}m)
                          </span>
                        )
                      ) : locationStatus === 'denied' ? (
                        <span className="text-[#CF222E] font-medium">{locationError || 'GPS permission denied'}</span>
                      ) : (
                        <span className="text-[#656D76]">Waiting for browser GPS coordinates...</span>
                      )}
                    </div>

                    {isGeofenceActive && (
                      <button
                        type="button"
                        onClick={requestLocation}
                        disabled={locationStatus === 'acquiring'}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#D0D7DE] text-[11px] font-semibold text-[#1F2328] hover:border-[#0969DA] hover:text-[#0969DA] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <Crosshair className={`w-3 h-3 ${locationStatus === 'acquiring' ? 'animate-spin' : ''}`} />
                        <span>Refresh GPS</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 2. Camera Biometrics Tactile Tile */}
                <div className="neu-raised p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-9 h-9 rounded-lg bg-white border flex items-center justify-center shrink-0 ${
                          !isBiometricActive || cameraStatus === 'ready'
                            ? 'border-[#34D058] text-[#1F883D]'
                            : cameraStatus === 'denied'
                            ? 'border-[#FF8182] text-[#CF222E]'
                            : 'border-[#D0D7DE] text-[#0969DA]'
                        }`}
                      >
                        <Camera className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-[#1F2328]">Camera Biometrics</div>
                        <div className="text-[11px] text-[#656D76]">
                          Face++ live facial verification
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                        !isBiometricActive
                          ? 'bg-white border-[#D0D7DE] text-[#656D76]'
                          : cameraStatus === 'ready'
                          ? 'bg-[#E6F6EC] text-[#1F883D] border-[#34D058]/60'
                          : cameraStatus === 'denied'
                          ? 'bg-[#FFEBE9] text-[#CF222E] border-[#FF8182]'
                          : 'bg-white border-[#D0D7DE] text-[#656D76]'
                      }`}
                    >
                      {!isBiometricActive ? 'Optional' : cameraStatus === 'ready' ? 'Ready' : 'Required'}
                    </span>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-[#D0D7DE]/70 flex items-center justify-between gap-2 text-[11px]">
                    <div>
                      {!isBiometricActive ? (
                        <span className="text-[#656D76]">Index number check-in active.</span>
                      ) : cameraStatus === 'ready' ? (
                        <span className="text-[#1F883D] font-medium">Camera stream active &amp; oval aligned</span>
                      ) : cameraStatus === 'denied' ? (
                        <span className="text-[#CF222E] font-medium">{cameraError}</span>
                      ) : (
                        <span className="text-[#656D76]">Requesting webcam stream...</span>
                      )}
                    </div>

                    {isBiometricActive && cameraStatus !== 'ready' && (
                      <button
                        type="button"
                        onClick={startCamera}
                        className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white border border-[#D0D7DE] text-[11px] font-semibold text-[#0969DA] hover:border-[#0969DA] transition-colors cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Enable</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Informational Policy Banners */}
              {(!isBiometricActive || !isGeofenceActive) && (
                <div className="bg-white border border-[#D0D7DE] rounded-xl p-3.5 text-xs flex items-start gap-2.5">
                  <Zap className="w-4 h-4 text-[#1F883D] shrink-0 mt-0.5" />
                  <div className="text-[#656D76]">
                    {!isBiometricActive && !isGeofenceActive && (
                      <span>
                        <strong className="text-[#1F2328]">Flexible Mode:</strong> Both GPS geofencing and facial biometrics are bypassed for this session.
                      </span>
                    )}
                    {!isBiometricActive && isGeofenceActive && (
                      <span>
                        <strong className="text-[#1F2328]">Simplified Mode:</strong> Verify with your Student Index Number while inside the classroom boundary.
                      </span>
                    )}
                    {isBiometricActive && !isGeofenceActive && (
                      <span>
                        <strong className="text-[#1F2328]">Remote Verification:</strong> Classroom GPS geofencing is bypassed. Verify with a live selfie from any location.
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Student Index Number Input (when biometrics is disabled) */}
              {!isBiometricActive && (
                <div className="bg-white border border-[#D0D7DE] rounded-xl p-4 shadow-xs space-y-2 animate-enter">
                  <label className="block text-xs font-semibold text-[#1F2328]">
                    Student Index Number
                  </label>
                  <div className="relative">
                    <Hash className="w-4 h-4 text-[#656D76] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="e.g. 10928374"
                      value={indexNumber}
                      onChange={(e) => setIndexNumber(e.target.value)}
                      className="w-full bg-white border border-[#D0D7DE] rounded-lg pl-9 pr-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-[#0969DA]"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-[#656D76]">
                    Enter your enrolled index number for {session.className}.
                  </p>
                </div>
              )}

              {/* Error Alert (Desktop) */}
              {submitError && (
                <div
                  role="alert"
                  className="hidden lg:flex bg-[#FFEBE9] border border-[#FF8182] text-[#CF222E] p-3.5 rounded-xl text-xs font-medium items-start gap-2 animate-enter"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Check-In Success Flash Card */}
        {checkInResult && (
          <div className="bg-white border border-[#34D058] rounded-xl p-6 sm:p-8 text-center shadow-sm animate-enter">
            <div className="w-16 h-16 neu-raised flex items-center justify-center text-[#1F883D] mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-[#1F2328] mb-1">Attendance Verified</h2>
            <p className="text-xs text-[#1F883D] font-semibold mb-6">
              Your attendance has been recorded for {session?.name}.
            </p>

            <div className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-xl p-4 sm:p-5 text-left max-w-sm mx-auto mb-6 space-y-2.5 text-xs">
              <div className="flex justify-between gap-2">
                <span className="text-[#656D76]">Student Name</span>
                <span className="font-bold text-[#1F2328] text-right">{checkInResult.student.fullName}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#656D76]">Index Number</span>
                <span className="font-mono font-bold text-[#1F2328]">
                  {checkInResult.student.indexNumber}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#656D76]">Class</span>
                <span className="font-medium text-[#1F2328] text-right">{session?.className}</span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#656D76]">Verification Match</span>
                <span className="font-mono text-[#1F883D] font-bold">
                  {checkInResult.confidence >= 1
                    ? 'Verified'
                    : `${(checkInResult.confidence * 100).toFixed(1)}%`}
                </span>
              </div>
              <div className="flex justify-between gap-2">
                <span className="text-[#656D76]">Timestamp</span>
                <span className="text-[#1F2328]">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setCheckInResult(null);
                setSession(null);
                setInputSessionId('');
                navigate('/check-in');
              }}
              className="w-full sm:w-auto bg-[#0969DA] text-white px-6 py-2.5 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="py-4 text-center text-xs text-[#656D76] border-t border-[#D0D7DE] bg-white">
        TruMark Biometric &amp; Geofenced Attendance System
      </footer>
    </div>
  );
}
