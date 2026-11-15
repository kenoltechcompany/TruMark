import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import {
  User,
  Hash,
  Camera,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  Lock,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import apiClient from '../../api/client';

export default function PublicRegistrationPage() {
  const { classId } = useParams<{ classId: string }>();
  const [step, setStep] = useState<
    'checking' | 'expired' | 'identity' | 'biometrics' | 'done'
  >('checking');
  const [className, setClassName] = useState('');
  const [fullName, setFullName] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [error, setError] = useState('');
  const [capturedImages, setCapturedImages] = useState<Blob[]>([]);
  const [currentCapture, setCurrentCapture] = useState(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);

  // Hands-free Auto-Capture states
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [autoCaptureCountdown, setAutoCaptureCountdown] = useState<number | null>(null);
  const [autoCapturePaused, setAutoCapturePaused] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Check registration status ──
  useQuery({
    queryKey: ['registration-status', classId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `/public/classes/${classId}/registration-status`,
      );
      setClassName(data.className);
      if (data.active) {
        setStep('identity');
      } else {
        setStep('expired');
      }
      return data;
    },
    enabled: !!classId,
    retry: false,
  });

  // Callback ref that immediately binds the MediaStream as soon as the <video> element mounts
  const attachVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    if (node && streamRef.current) {
      node.srcObject = streamRef.current;
      node.play().catch(() => {});
    }
  }, []);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  // ── Camera controls (Progressive fallback for laptops/phones & busy webcams) ──
  const startCamera = useCallback(async () => {
    setError('');
    setAutoCapturePaused(false);
    setStep('biometrics');
    setIsStartingCamera(true);

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }

      streamRef.current = stream;
      setCameraReady(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err: any) {
      setCameraReady(false);
      setAutoCapturePaused(true);
      if (err?.name === 'NotReadableError' || err?.name === 'TrackStartError') {
        setError(
          'Your camera is currently in use by another tab or app. Close any other TruMark check-in tab and tap "Retry Camera".',
        );
      } else {
        setError('Could not access camera. Please allow camera permissions and tap "Retry Camera".');
      }
    } finally {
      setIsStartingCamera(false);
    }
  }, []);

  // ── Submit registration ──
  const submitMutation = useMutation({
    mutationFn: async (images: Blob[]) => {
      const formData = new FormData();
      formData.append('fullName', fullName.trim());
      formData.append('indexNumber', indexNumber.trim());
      images.forEach((img, i) =>
        formData.append('images', img, `capture_${i + 1}.jpg`),
      );
      return apiClient.post(
        `/public/classes/${classId}/register-student`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 45000,
        },
      );
    },
    onSuccess: () => {
      stopCamera();
      setStep('done');
    },
    onError: (err: any) => {
      setAutoCapturePaused(true);
      setError(
        err.response?.data?.message ||
          'Enrollment failed. Ensure your face is clearly visible in good lighting and try again.',
      );
      setStep('biometrics');
      setCapturedImages([]);
      setCurrentCapture(0);
    },
  });

  const snapPhoto = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return;

    const rawW = video.videoWidth || 640;
    const rawH = video.videoHeight || 480;
    const scale = Math.min(1, 640 / Math.max(rawW, rawH));
    canvas.width = Math.round(rawW * scale);
    canvas.height = Math.round(rawH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const next = [...capturedImages, blob];
        setCapturedImages(next);
        setAutoCaptureCountdown(null);

        if (currentCapture >= 2) {
          stopCamera();
          submitMutation.mutate(next);
        } else {
          setCurrentCapture((c) => c + 1);
        }
      },
      'image/jpeg',
      0.85,
    );
  }, [cameraReady, capturedImages, currentCapture, stopCamera, submitMutation]);

  // Hands-free Auto-Capture countdown for each of the 3 angles
  useEffect(() => {
    const canAutoCapture =
      step === 'biometrics' &&
      cameraReady &&
      autoCaptureEnabled &&
      !autoCapturePaused &&
      !submitMutation.isPending &&
      !error;

    if (!canAutoCapture) {
      setAutoCaptureCountdown(null);
      return;
    }

    let cancelled = false;
    let countdownTimer: ReturnType<typeof setInterval> | null = null;

    // Give a 1.3s pause between angles so the student has time to turn slightly left/right
    const prepDelayMs = currentCapture === 0 ? 500 : 1400;
    const prepTimer = setTimeout(() => {
      if (cancelled) return;
      let remaining = 3;
      setAutoCaptureCountdown(remaining);

      countdownTimer = setInterval(() => {
        if (cancelled) return;
        remaining -= 1;
        if (remaining <= 0) {
          if (countdownTimer) clearInterval(countdownTimer);
          setAutoCaptureCountdown(null);
          snapPhoto();
        } else {
          setAutoCaptureCountdown(remaining);
        }
      }, 900);
    }, prepDelayMs);

    return () => {
      cancelled = true;
      clearTimeout(prepTimer);
      if (countdownTimer) clearInterval(countdownTimer);
    };
  }, [
    step,
    cameraReady,
    autoCaptureEnabled,
    autoCapturePaused,
    submitMutation.isPending,
    error,
    currentCapture,
    snapPhoto,
  ]);

  const prompts = [
    { title: 'Angle 1 of 3: Front Profile', instruction: 'Look straight into the camera with neutral lighting' },
    { title: 'Angle 2 of 3: Slight Left Turn', instruction: 'Turn your head slightly to your left (~15 degrees)' },
    { title: 'Angle 3 of 3: Slight Right Turn', instruction: 'Turn your head slightly to your right (~15 degrees)' },
  ];

  const activeStepIndex = step === 'identity' ? 0 : step === 'biometrics' ? 1 : 2;

  return (
    <div className="min-h-screen neu-surface flex flex-col justify-between text-[#1F2328] font-sans">
      {/* ── Top Header ── */}
      <header className="bg-white border-b border-[#D0D7DE] py-3 px-4 sm:px-6 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
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
              <span className="hidden sm:inline">Face++ 3-Angle Enrollment</span>
              <span className="sm:hidden">3-Angle Enroll</span>
            </span>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="max-w-xl w-full mx-auto px-3.5 sm:px-6 py-5 sm:py-8 my-auto">
        {step === 'checking' && (
          <div className="bg-white border border-[#D0D7DE] rounded-xl p-10 sm:p-12 text-center shadow-xs animate-enter">
            <div className="inline-flex items-center justify-center w-12 h-12 neu-raised mb-4">
              <RefreshCw className="w-5 h-5 text-[#0969DA] animate-spin" />
            </div>
            <p className="text-sm font-semibold text-[#1F2328]">Verifying Class Onboarding Link...</p>
            <p className="text-xs text-[#656D76] mt-1">Checking enrollment window status</p>
          </div>
        )}

        {step === 'expired' && (
          <div className="bg-white border border-[#D0D7DE] rounded-xl p-6 sm:p-8 text-center shadow-xs animate-enter">
            <div className="w-14 h-14 neu-raised flex items-center justify-center text-[#CF222E] mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-[#1F2328] mb-1.5">
              Registration Window Closed
            </h2>
            <p className="text-xs sm:text-sm text-[#656D76] max-w-md mx-auto mb-6">
              Self-onboarding for <strong>{className || 'this class'}</strong> is currently disabled. Contact your Course Representative or lecturer to open the registration switch.
            </p>
            <Link
              to="/check-in"
              className="inline-flex items-center gap-1.5 bg-[#0969DA] text-white px-4 py-2.5 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors"
            >
              <span>Go to Session Check-In</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* High-Visibility Enrollment Success Card */}
        {step === 'done' && (
          <div className="bg-white border-2 border-[#1F883D] rounded-2xl overflow-hidden shadow-lg animate-enter">
            <div className="bg-[#1F883D] text-white px-6 py-7 text-center">
              <div className="w-16 h-16 rounded-full bg-white text-[#1F883D] flex items-center justify-center mx-auto mb-3 shadow-md">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <span className="inline-block bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-3 py-0.5 rounded-full mb-2">
                Enrollment Complete
              </span>
              <h2 className="text-2xl font-extrabold tracking-tight">
                Face Profile Registered!
              </h2>
              <p className="text-xs sm:text-sm text-white/90 mt-1">
                Your 3-angle facial signature is now active for <strong>{className}</strong>.
              </p>
            </div>

            <div className="p-6 text-center space-y-5">
              {/* 3-Angle Verified Strip */}
              <div className="grid grid-cols-3 gap-2 max-w-sm mx-auto">
                {['Front Profile', 'Left Angle', 'Right Angle'].map((label) => (
                  <div
                    key={label}
                    className="bg-[#E6F6EC] border border-[#34D058]/60 text-[#1F883D] rounded-lg py-1.5 px-2 text-[11px] font-bold flex items-center justify-center gap-1"
                  >
                    <CheckCircle2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">{label}</span>
                  </div>
                ))}
              </div>

              <div className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-xl p-4 text-left max-w-sm mx-auto space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-[#656D76]">Full Name</span>
                  <span className="font-bold text-[#1F2328] text-right">{fullName}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#656D76]">Index Number</span>
                  <span className="font-mono font-bold text-[#1F2328]">{indexNumber}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#656D76]">Enrolled Class</span>
                  <span className="font-medium text-[#1F2328] text-right">{className}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#656D76]">Biometric Status</span>
                  <span className="text-[#1F883D] font-bold">3 / 3 Verified</span>
                </div>
              </div>

              <Link
                to="/check-in"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-[#0969DA] text-white px-6 py-2.5 rounded-lg text-xs font-bold hover:bg-[#0353A4] transition-colors"
              >
                <span>Proceed to Session Check-In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {(step === 'identity' || step === 'biometrics') && (
          <div className="space-y-4 sm:space-y-5 animate-enter">
            {/* Title Banner */}
            <div className="text-center">
              <span className="border-l-2 border-[#0969DA] pl-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#656D76]">
                Student Self-Onboarding
              </span>
              <h2 className="text-xl sm:text-2xl font-bold text-[#1F2328] mt-1">
                {className}
              </h2>
              <p className="text-xs text-[#656D76] mt-1">
                Register your student index number and 3 reference face angles for hands-free classroom check-in.
              </p>
            </div>

            {/* Tactile Segmented Step Track */}
            <div className="flex justify-center">
              <div className="neu-track w-full grid grid-cols-3 text-center text-[11px] sm:text-xs">
                {['1. Identity', '2. Biometrics', '3. Enrolled'].map((label, i) => (
                  <div
                    key={label}
                    className={`neu-tab py-2 px-1.5 sm:px-2 font-semibold truncate ${
                      i === activeStepIndex
                        ? 'active text-[#0969DA]'
                        : i < activeStepIndex
                        ? 'text-[#1F883D]'
                        : 'text-[#656D76]'
                    }`}
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* High-Visibility Enrollment Error Card */}
            {error && (
              <div
                role="alert"
                className="bg-white border-2 border-[#CF222E] rounded-xl overflow-hidden shadow-md animate-enter"
              >
                <div className="bg-[#CF222E] text-white px-4 py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>Enrollment Issue</span>
                  </div>
                  {step === 'biometrics' && (
                    <button
                      type="button"
                      onClick={startCamera}
                      className="inline-flex items-center gap-1 bg-white text-[#CF222E] px-2.5 py-1 rounded-md text-[11px] font-bold hover:bg-[#FFEBE9] transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restart Capture</span>
                    </button>
                  )}
                </div>
                <div className="p-3.5 bg-[#FFEBE9]/40 text-xs font-medium text-[#CF222E]">
                  {error}
                </div>
              </div>
            )}

            {/* Main Card */}
            <div className="bg-white border border-[#D0D7DE] rounded-xl p-4 sm:p-6 shadow-xs">
              {step === 'identity' && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    startCamera();
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
                      Full Name
                    </label>
                    <div className="relative">
                      <User className="w-4 h-4 text-[#656D76] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="e.g. Ama Osei"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="border border-[#D0D7DE] rounded-lg pl-9 pr-3.5 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-[#0969DA]"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
                      Student Index Number
                    </label>
                    <div className="relative">
                      <Hash className="w-4 h-4 text-[#656D76] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        type="text"
                        placeholder="e.g. 10928374"
                        value={indexNumber}
                        onChange={(e) => setIndexNumber(e.target.value)}
                        className="border border-[#D0D7DE] rounded-lg pl-9 pr-3.5 py-2.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-[#0969DA]"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      className="w-full bg-[#0969DA] text-white py-2.5 px-4 rounded-lg text-sm font-semibold hover:bg-[#0353A4] active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <span>Continue to Biometric Capture</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              )}

              {step === 'biometrics' && (
                <div className="space-y-3.5 sm:space-y-4">
                  {/* 3-Photo Progress Prompt + Auto-Scan Toggle */}
                  <div className="neu-raised p-3 sm:p-3.5 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA] font-bold text-xs shrink-0">
                        {currentCapture + 1}/3
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[#1F2328] truncate">
                          {prompts[currentCapture]?.title}
                        </div>
                        <div className="text-[11px] text-[#656D76]">
                          {prompts[currentCapture]?.instruction}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setAutoCaptureEnabled((v) => !v);
                        setAutoCapturePaused(false);
                      }}
                      className={`shrink-0 text-[11px] font-semibold px-2.5 py-1 rounded-md border transition-colors cursor-pointer ${
                        autoCaptureEnabled
                          ? 'bg-[#E6F6EC] border-[#34D058] text-[#1F883D]'
                          : 'bg-white border-[#D0D7DE] text-[#656D76]'
                      }`}
                    >
                      Auto: {autoCaptureEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>

                  {/* Camera Viewfinder */}
                  <div className="relative aspect-[3/4] sm:aspect-[4/3] max-h-[55vh] sm:max-h-none bg-[#0D1117] rounded-xl overflow-hidden border border-[#1F2328] flex items-center justify-center">
                    <video
                      ref={attachVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                    <canvas ref={canvasRef} className="hidden" />

                    {/* Corner Brackets */}
                    <div className="absolute inset-3 sm:inset-4 pointer-events-none">
                      <div className="absolute top-0 left-0 w-5 h-5 border-t-2 border-l-2 border-white/70 rounded-tl" />
                      <div className="absolute top-0 right-0 w-5 h-5 border-t-2 border-r-2 border-white/70 rounded-tr" />
                      <div className="absolute bottom-0 left-0 w-5 h-5 border-b-2 border-l-2 border-white/70 rounded-bl" />
                      <div className="absolute bottom-0 right-0 w-5 h-5 border-b-2 border-r-2 border-white/70 rounded-br" />
                    </div>

                    {/* Alignment Oval + Scan Line */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                      <div className="relative w-40 h-52 sm:w-44 sm:h-60 border-2 border-dashed border-[#34D058] rounded-full flex items-center justify-center overflow-hidden">
                        {cameraReady && (
                          <div className="w-36 h-0.5 bg-[#34D058]/85 rounded-full animate-scan-line" />
                        )}
                      </div>
                    </div>

                    {/* Auto-Capture Countdown Pill inside Viewfinder */}
                    {cameraReady &&
                      autoCaptureEnabled &&
                      !autoCapturePaused &&
                      !submitMutation.isPending &&
                      autoCaptureCountdown !== null && (
                        <div className="absolute bottom-3 inset-x-0 flex justify-center px-3 pointer-events-none">
                          <div className="bg-[#0D1117]/85 border border-[#34D058] text-white px-4 py-1.5 rounded-full text-xs font-semibold flex items-center gap-2 shadow-lg">
                            <span className="w-5 h-5 rounded-full bg-[#1F883D] text-white flex items-center justify-center font-bold text-[11px]">
                              {autoCaptureCountdown}
                            </span>
                            <span>
                              Capturing Angle {currentCapture + 1}/3 in {autoCaptureCountdown}s
                            </span>
                          </div>
                        </div>
                      )}

                    {/* Enrolling Biometrics Full Overlay */}
                    {submitMutation.isPending && (
                      <div className="absolute inset-0 bg-[#0D1117]/85 flex flex-col items-center justify-center p-6 text-center text-white z-10">
                        <div className="w-12 h-12 border-4 border-[#34D058] border-t-transparent rounded-full animate-spin mb-3" />
                        <p className="text-sm font-bold">Enrolling Facial Biometrics...</p>
                        <p className="text-xs text-white/75 mt-1">
                          Registering your 3 reference angles with Face++
                        </p>
                      </div>
                    )}

                    {/* Overlay if camera stream is initializing or blocked */}
                    {!cameraReady && !submitMutation.isPending && (
                      <div className="absolute inset-0 bg-[#0D1117]/90 flex flex-col items-center justify-center p-6 text-center text-white">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-3">
                          {isStartingCamera ? (
                            <RefreshCw className="w-6 h-6 text-white animate-spin" />
                          ) : (
                            <Camera className="w-6 h-6 text-white" />
                          )}
                        </div>
                        <p className="text-sm font-semibold mb-1">
                          {isStartingCamera ? 'Starting Camera...' : 'Camera Preview Not Active'}
                        </p>
                        <p className="text-xs text-white/70 mb-4 max-w-xs">
                          {isStartingCamera
                            ? 'Connecting to your device camera...'
                            : 'Make sure no other browser tab is using your camera, then tap below.'}
                        </p>
                        {!isStartingCamera && (
                          <button
                            type="button"
                            onClick={startCamera}
                            className="bg-[#0969DA] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors cursor-pointer"
                          >
                            Enable / Retry Camera
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Tactile Shutter Bar */}
                  <div className="neu-surface border border-[#D0D7DE] rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        stopCamera();
                        setCapturedImages([]);
                        setCurrentCapture(0);
                        setStep('identity');
                      }}
                      className="inline-flex items-center gap-1 bg-white border border-[#D0D7DE] text-[#1F2328] px-2.5 sm:px-3 py-2 rounded-lg text-xs font-semibold hover:bg-[#F6F8FA] transition-colors cursor-pointer shrink-0"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>

                    <div className="text-center min-w-0">
                      <div className="text-xs font-bold text-[#1F2328] truncate">
                        {submitMutation.isPending
                          ? 'Enrolling Biometrics...'
                          : autoCaptureCountdown !== null
                          ? `Auto-capturing ${currentCapture + 1}/3 in ${autoCaptureCountdown}s`
                          : `Capture ${currentCapture + 1} of 3`}
                      </div>
                      <div className="text-[11px] text-[#656D76] truncate">
                        {submitMutation.isPending
                          ? 'Validating Face++'
                          : 'Hold still or tap shutter anytime'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={snapPhoto}
                      disabled={submitMutation.isPending || !cameraReady}
                      aria-label={`Capture photo ${currentCapture + 1} of 3`}
                      className="neu-shutter shrink-0"
                    >
                      {submitMutation.isPending ? (
                        <div className="w-6 h-6 border-2 border-[#0969DA] border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-[#1F883D] flex items-center justify-center text-white shadow-xs">
                          <Camera className="w-5 h-5" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
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
