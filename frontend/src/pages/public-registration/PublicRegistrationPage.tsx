import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
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
  const videoRef = useRef<HTMLVideoElement>(null);
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

  // Ensure camera stream is attached when biometrics step mounts
  useEffect(() => {
    if (step === 'biometrics' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [step]);

  // Clean up camera stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // ── Submit registration ──
  const submitMutation = useMutation({
    mutationFn: async (images: Blob[]) => {
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('indexNumber', indexNumber);
      images.forEach((img, i) =>
        formData.append('images', img, `capture_${i + 1}.jpg`),
      );
      return apiClient.post(
        `/public/classes/${classId}/register-student`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        },
      );
    },
    onSuccess: () => setStep('done'),
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Registration failed.');
      setStep('biometrics');
      setCapturedImages([]);
      setCurrentCapture(0);
      // Restart camera if stopped
      startCamera();
    },
  });

  // ── Camera controls ──
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      setStep('biometrics');
    } catch {
      setError('Could not access camera. Please grant camera permissions.');
    }
  };

  const snapPhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const next = [...capturedImages, blob];
        setCapturedImages(next);

        if (currentCapture >= 2) {
          // All 3 captured
          stopCamera();
          submitMutation.mutate(next);
        } else {
          setCurrentCapture((c) => c + 1);
        }
      },
      'image/jpeg',
      0.9,
    );
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const prompts = [
    'Look straight at the camera',
    'Turn slightly to your left',
    'Turn slightly to your right',
  ];

  // ── Render states ──
  if (step === 'checking') {
    return (
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center p-4">
        <p className="text-[#656D76]">Checking registration status…</p>
      </div>
    );
  }

  if (step === 'expired') {
    return (
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center p-4">
        <div className="bg-white border border-[#D0D7DE] rounded-md shadow-sm p-6 w-full max-w-md text-center">
          <h2 className="text-lg font-semibold text-[#1F2328] mb-2">
            Registration Window Closed
          </h2>
          <p className="text-sm text-[#656D76]">
            The registration link for this class is currently disabled. Please contact
            your course representative or instructor to open registration.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center p-4">
        <div className="bg-white border border-[#D0D7DE] rounded-md shadow-sm p-6 w-full max-w-md text-center">
          <div className="w-12 h-12 bg-[#E6F6EC] text-[#1F883D] rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold">
            ✓
          </div>
          <h2 className="text-lg font-semibold text-[#1F2328] mb-2">
            Registration Complete
          </h2>
          <p className="text-sm text-[#656D76] mb-4">
            You are enrolled in <strong>{className}</strong>. Your profile and biometric face reference have been registered successfully.
          </p>
          <div className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-md p-3 text-xs text-[#656D76] text-left">
            <div>
              <strong>Name:</strong> {fullName}
            </div>
            <div>
              <strong>Index Number:</strong> {indexNumber}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-sm p-6 w-full max-w-lg">
        <h2 className="text-lg font-semibold text-[#1F2328] mb-1">
          Register for {className}
        </h2>
        <p className="text-xs text-[#656D76] mb-4">
          Self-onboarding for TruMark biometric attendance.
        </p>

        {error && (
          <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#D73A49] text-xs p-2.5 rounded-md mb-4">
            {error}
          </div>
        )}

        {/* Step indicators */}
        <div className="flex gap-2 mb-4">
          {['Identity', 'Biometrics (3 Photos)', 'Submitted'].map((label, i) => {
            const activeIdx = step === 'identity' ? 0 : step === 'biometrics' ? 1 : 2;
            return (
              <div
                key={label}
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                  i === activeIdx
                    ? 'bg-[#0969DA] text-white'
                    : i < activeIdx
                    ? 'bg-[#1F883D] text-white'
                    : 'bg-[#F6F8FA] text-[#656D76] border border-[#D0D7DE]'
                }`}
              >
                {label}
              </div>
            );
          })}
        </div>

        {step === 'identity' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              startCamera();
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. Ama Osei"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Index Number</label>
              <input
                type="text"
                placeholder="e.g. 10928374"
                value={indexNumber}
                onChange={(e) => setIndexNumber(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
            >
              Next: Take Reference Photos
            </button>
          </form>
        )}

        {step === 'biometrics' && (
          <div className="space-y-3">
            <div className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-md p-2.5 text-xs text-[#1F2328]">
              <strong>Photo {currentCapture + 1} of 3:</strong>{' '}
              {prompts[currentCapture]}
            </div>

            <div className="relative aspect-video bg-black rounded-md overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <canvas ref={canvasRef} className="hidden" />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={snapPhoto}
                disabled={submitMutation.isPending}
                className="bg-[#1F883D] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#1A7F37] transition-colors disabled:opacity-50"
              >
                {submitMutation.isPending
                  ? 'Submitting…'
                  : `Capture Photo (${currentCapture + 1}/3)`}
              </button>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setCapturedImages([]);
                  setCurrentCapture(0);
                  setStep('identity');
                }}
                className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
