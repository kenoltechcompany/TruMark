import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
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
          setLocationError('Location permission denied. Please enable location access in browser settings.');
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
    } catch (err: any) {
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
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9),
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
          timeout: 25000,
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

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex flex-col justify-between text-[#1F2328]">
      {/* Top Header */}
      <header className="bg-white border-b border-[#D0D7DE] py-3.5 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[#0969DA] flex items-center justify-center text-white font-bold text-sm shadow-sm">
            TM
          </div>
          <div>
            <h1 className="text-base font-semibold leading-none text-[#1F2328]">TruMark</h1>
            <span className="text-[11px] text-[#656D76]">Web Attendance Check-In</span>
          </div>
        </div>
        <div className="text-xs text-[#656D76]">
          Secure Attendance Portal
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-2xl w-full mx-auto p-4 sm:p-6 my-auto">
        {/* If no session loaded, show Session ID input */}
        {!session && !isLoadingSession && (
          <div className="bg-white border border-[#D0D7DE] rounded-xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-[#1F2328] mb-1">Enter Session ID</h2>
            <p className="text-xs text-[#656D76] mb-5">
              Paste the Session ID or scan the QR code displayed on your lecturer or course rep's screen.
            </p>

            {sessionError && (
              <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#D73A49] px-3.5 py-2.5 rounded-md text-xs mb-4">
                {sessionError}
              </div>
            )}

            <form onSubmit={handleManualSessionLookup} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#656D76] mb-1.5">Session ID / Token</label>
                <input
                  type="text"
                  placeholder="e.g. 736af390-fe05-47e2-b600-47d76b1e5e99"
                  value={inputSessionId}
                  onChange={(e) => setInputSessionId(e.target.value)}
                  className="w-full border border-[#D0D7DE] rounded-md px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#0969DA] text-white py-2 px-4 rounded-md text-sm font-semibold hover:bg-[#0353A4] transition-colors"
              >
                Find Session
              </button>
            </form>
          </div>
        )}

        {isLoadingSession && (
          <div className="bg-white border border-[#D0D7DE] rounded-xl p-10 text-center shadow-sm">
            <div className="inline-block animate-spin w-8 h-8 border-4 border-[#0969DA] border-t-transparent rounded-full mb-3" />
            <p className="text-sm font-medium text-[#656D76]">Loading session details...</p>
          </div>
        )}

        {/* Active Session Card */}
        {session && !checkInResult && (
          <div className="space-y-4">
            {/* Session Info Banner */}
            <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E4E8] pb-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-[#1F2328]">{session.name}</h2>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        session.isActive
                          ? 'bg-[#E6FFED] text-[#1F883D] border border-[#34D058]'
                          : 'bg-[#FFEBE9] text-[#CF222E] border border-[#FF8182]'
                      }`}
                    >
                      {session.isActive ? '● Live Session' : 'Inactive / Closed'}
                    </span>
                  </div>
                  <p className="text-xs text-[#656D76] mt-0.5">
                    {session.className} &bull; {session.classroomName}
                  </p>
                </div>
                <div className="text-left sm:text-right text-xs text-[#656D76]">
                  <div>Ends: {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>

              {/* Informational Policy Banners */}
              {!isBiometricActive && !isGeofenceActive && (
                <div className="bg-[#E6F6EC] border border-[#34D058] text-[#1F883D] p-3 rounded-lg text-xs font-medium mb-3 flex items-center justify-between">
                  <span>⚡ Flexible Mode: GPS Geofencing and Facial Biometrics are disabled by institutional policy.</span>
                </div>
              )}
              {!isBiometricActive && isGeofenceActive && (
                <div className="bg-[#E6F6EC] border border-[#34D058] text-[#1F883D] p-3 rounded-lg text-xs font-medium mb-3 flex items-center justify-between">
                  <span>⚡ Simplified Mode: Biometric face verification is disabled. Verify with Student Index Number inside the classroom.</span>
                </div>
              )}
              {isBiometricActive && !isGeofenceActive && (
                <div className="bg-[#E6F6EC] border border-[#34D058] text-[#1F883D] p-3 rounded-lg text-xs font-medium mb-3 flex items-center justify-between">
                  <span>⚡ Remote Verification: Classroom GPS geofencing is bypassed. Verify your attendance with selfie biometrics from any location.</span>
                </div>
              )}

              {/* Status Indicators Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* GPS Status */}
                <div
                  className={`border rounded-lg p-3 ${
                    !isGeofenceActive
                      ? 'bg-[#F6F8FA] border-[#D0D7DE] text-[#1F883D]'
                      : locationStatus === 'ready'
                      ? isWithinGeofence
                        ? 'bg-[#F0FFF4] border-[#34D058] text-[#1A7F37]'
                        : 'bg-[#FFF5F5] border-[#FF8182] text-[#CF222E]'
                      : 'bg-[#F6F8FA] border-[#D0D7DE] text-[#656D76]'
                  }`}
                >
                  <div className="font-semibold flex items-center justify-between">
                    <span>GPS Classroom Geofence</span>
                    {!isGeofenceActive ? (
                      <span className="text-xs text-[#1F883D] font-medium">Bypassed</span>
                    ) : (
                      locationStatus === 'acquiring' && <span className="animate-pulse">Locating...</span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px]">
                    {!isGeofenceActive ? (
                      <span className="text-[#656D76]">Geofencing validation is disabled for this session.</span>
                    ) : locationStatus === 'ready' ? (
                      isWithinGeofence ? (
                        <span>
                          ✓ Inside boundary ({Math.round(distanceToClassroom ?? 0)}m from center, &plusmn;{coords?.accuracy}m)
                        </span>
                      ) : (
                        <span>
                          ✗ {Math.round(distanceToClassroom ?? 0)}m away (Allowed: max {session.classroomBoundaries.radiusMeters + 5}m)
                        </span>
                      )
                    ) : locationStatus === 'denied' ? (
                      <span className="text-[#CF222E]">{locationError || 'GPS permission denied'}</span>
                    ) : (
                      <button
                        onClick={requestLocation}
                        className="text-[#0969DA] font-semibold hover:underline"
                      >
                        Enable Location Access
                      </button>
                    )}
                  </div>
                </div>

                {/* Webcam Status */}
                <div
                  className={`border rounded-lg p-3 ${
                    !isBiometricActive
                      ? 'bg-[#F6F8FA] border-[#D0D7DE] text-[#656D76]'
                      : cameraStatus === 'ready'
                      ? 'bg-[#F0FFF4] border-[#34D058] text-[#1A7F37]'
                      : 'bg-[#F6F8FA] border-[#D0D7DE] text-[#656D76]'
                  }`}
                >
                  <div className="font-semibold flex items-center justify-between">
                    <span>Webcam Biometrics</span>
                    <span>
                      {!isBiometricActive
                        ? 'Optional'
                        : cameraStatus === 'ready'
                        ? '✓ Ready'
                        : 'Required'}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px]">
                    {!isBiometricActive ? (
                      <span>Index number check-in active. Selfie photo is optional.</span>
                    ) : cameraStatus === 'ready' ? (
                      <span>Camera active and aligned</span>
                    ) : cameraStatus === 'denied' ? (
                      <span className="text-[#CF222E]">{cameraError}</span>
                    ) : (
                      <button
                        onClick={startCamera}
                        className="text-[#0969DA] font-semibold hover:underline"
                      >
                        Enable Camera Access
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* If Biometrics is disabled, provide Student Index Number field */}
            {!isBiometricActive && (
              <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-sm space-y-2">
                <label className="block text-xs font-semibold text-[#1F2328]">
                  Student Index Number
                </label>
                <input
                  type="text"
                  placeholder="e.g. 10928374"
                  value={indexNumber}
                  onChange={(e) => setIndexNumber(e.target.value)}
                  className="w-full border border-[#D0D7DE] rounded-md px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-xs"
                  required
                />
                <p className="text-[11px] text-[#656D76]">
                  Enter your assigned student index number for {session.className}.
                </p>
              </div>
            )}

            {/* Error Message */}
            {submitError && (
              <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#CF222E] p-3.5 rounded-lg text-xs font-medium">
                {submitError}
              </div>
            )}

            {/* Camera Viewport & Verification */}
            <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-sm">
              <div className="relative w-full aspect-[4/3] max-w-md mx-auto bg-black rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Biometric Face Alignment Overlay */}
                {isBiometricActive && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                    <div
                      className={`w-48 h-64 border-2 border-dashed rounded-full transition-colors ${
                        !isGeofenceActive || isWithinGeofence ? 'border-[#34D058]' : 'border-[#FF8182]'
                      }`}
                      style={{ opacity: 0.85 }}
                    />
                  </div>
                )}

                {cameraStatus !== 'ready' && isBiometricActive && (
                  <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center p-4 text-center text-white">
                    <p className="text-sm mb-3">Camera is required for facial verification.</p>
                    <button
                      onClick={startCamera}
                      className="bg-[#0969DA] text-white px-4 py-2 rounded-md text-xs font-semibold hover:bg-[#0353A4]"
                    >
                      Grant Camera Permission
                    </button>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="mt-5 max-w-md mx-auto">
                <button
                  type="button"
                  onClick={handleCaptureAndCheckIn}
                  disabled={
                    isSubmitting ||
                    !session.isActive ||
                    (isGeofenceActive && (locationStatus !== 'ready' || !isWithinGeofence)) ||
                    (isBiometricActive ? cameraStatus !== 'ready' : !indexNumber.trim())
                  }
                  className="w-full bg-[#1F883D] text-white py-3 px-4 rounded-lg text-sm font-bold hover:bg-[#1A7F37] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>
                        {isBiometricActive
                          ? 'Verifying Biometrics...'
                          : 'Recording Attendance...'}
                      </span>
                    </>
                  ) : (
                    <span>
                      {isBiometricActive
                        ? '📸 Capture & Mark Attendance'
                        : '✓ Mark Attendance'}
                    </span>
                  )}
                </button>

                {isGeofenceActive && !isWithinGeofence && coords && (
                  <p className="text-[11px] text-[#CF222E] text-center mt-2 font-medium">
                    You must be inside {session.classroomName} to mark attendance.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Check-In Success Flash Card */}
        {checkInResult && (
          <div className="bg-white border border-[#34D058] rounded-xl p-8 text-center shadow-lg animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-[#E6FFED] border border-[#34D058] text-[#1F883D] rounded-full flex items-center justify-center text-2xl mx-auto mb-4">
              ✓
            </div>
            <h2 className="text-xl font-bold text-[#1F2328] mb-1">Attendance Verified!</h2>
            <p className="text-xs text-[#1F883D] font-semibold mb-6">
              Attendance has been successfully recorded.
            </p>

            <div className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-lg p-5 text-left max-w-sm mx-auto mb-6 space-y-2">
              <div className="text-xs">
                <span className="text-[#656D76]">Student Name:</span>
                <span className="font-bold text-[#1F2328] ml-2">{checkInResult.student.fullName}</span>
              </div>
              <div className="text-xs">
                <span className="text-[#656D76]">Index Number:</span>
                <span className="font-semibold text-[#1F2328] ml-2">{checkInResult.student.indexNumber}</span>
              </div>
              {checkInResult.confidence > 0 && (
                <div className="text-xs">
                  <span className="text-[#656D76]">Verification Confidence:</span>
                  <span className="font-semibold text-[#0969DA] ml-2">
                    {Math.round(checkInResult.confidence * 100)}% match
                  </span>
                </div>
              )}
              <div className="text-xs">
                <span className="text-[#656D76]">Timestamp:</span>
                <span className="text-[#1F2328] ml-2">{new Date().toLocaleTimeString()}</span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => {
                  setCheckInResult(null);
                  if (isBiometricActive) startCamera();
                }}
                className="w-full sm:w-auto bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-4 py-2 rounded-md text-xs font-semibold hover:bg-[#F3F4F6] transition-colors"
              >
                Mark Another Student
              </button>
              <Link
                to={`/public/register/${session?.id || ''}`}
                className="w-full sm:w-auto bg-[#0969DA] text-white px-4 py-2 rounded-md text-xs font-semibold hover:bg-[#0353A4] transition-colors inline-block"
              >
                Done
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-[#656D76] border-t border-[#D0D7DE] bg-white">
        TruMark Attendance System • Privacy-Compliant Verification
      </footer>
    </div>
  );
}
