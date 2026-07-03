import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { useState, useRef } from 'react';
import apiClient from '../../api/client';

export default function PublicRegistrationPage() {
  const { classId } = useParams<{ classId: string }>();
  const [step, setStep] = useState<'checking' | 'expired' | 'identity' | 'biometrics' | 'done'>('checking');
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
      const { data } = await apiClient.get(`/public/classes/${classId}/registration-status`);
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

  // ── Submit registration ──
  const submitMutation = useMutation({
    mutationFn: async (images: Blob[]) => {
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('indexNumber', indexNumber);
      images.forEach((img) => formData.append('images', img, `capture.jpg`));
      return apiClient.post(`/public/classes/${classId}/register-student`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => setStep('done'),
    onError: (err: any) => {
      setError(err.response?.data?.message || 'Registration failed.');
      setStep('biometrics');
      setCapturedImages([]);
      setCurrentCapture(0);
    },
  });

  // ── Camera controls ──
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStep('biometrics');
    } catch {
      setError('Could not access camera. Please grant camera permissions.');
    }
  };

  const snapPhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
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
    }, 'image/jpeg');
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // ── Render states ──
  if (step === 'checking') {
    return (
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center">
        <p className="text-[#656D76]">Checking registration status…</p>
      </div>
    );
  }

  if (step === 'expired') {
    return (
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center">
        <div className="bg-white border border-[#D0D7DE] rounded-md shadow-sm p-6 w-full max-w-md text-center">
          <h2 className="text-lg font-semibold text-[#1F2328] mb-2">Registration Link Expired or Disabled</h2>
          <p className="text-sm text-[#656D76]">
            The registration window for this class is currently closed. Please contact your instructor.
          </p>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center">
        <div className="bg-white border border-[#D0D7DE] rounded-md shadow-sm p-6 w-full max-w-md text-center">
          <h2 className="text-lg font-semibold text-[#1F2328] mb-2">Registration Successful!</h2>
          <p className="text-sm text-[#656D76]">
            You have been registered for <strong>{className}</strong>. You can now close this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F6F8FA] flex items-center justify-center">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-sm p-6 w-full max-w-lg">
        <h2 className="text-lg font-semibold text-[#1F2328] mb-1">Register for {className}</h2>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {/* Step indicators */}
        <div className="flex gap-2 mb-4">
          {['Identity', 'Photos', 'Submit'].map((label, i) => {
            const activeIdx = step === 'identity' ? 0 : step === 'biometrics' ? 1 : 2;
            return (
              <div
                key={label}
                className={`text-xs px-2 py-1 rounded-full ${
                  i === activeIdx
                    ? 'bg-[#0969DA] text-white'
                    : i < activeIdx
                    ? 'bg-[#1F883D] text-white'
                    : 'bg-[#F6F8FA] text-[#656D76]'
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
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Index Number</label>
              <input
                type="text"
                value={indexNumber}
                onChange={(e) => setIndexNumber(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
            <button
              type="submit"
              className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
            >
              Next — Take Photos
            </button>
          </form>
        )}

        {step === 'biometrics' && (
          <div className="space-y-3">
            <p className="text-sm text-[#656D76]">
              Photo {currentCapture + 1} of 3 — Position your face in the frame
            </p>
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-md bg-black" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-2">
              <button
                onClick={snapPhoto}
                disabled={submitMutation.isPending}
                className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors disabled:opacity-50"
              >
                {submitMutation.isPending ? 'Submitting…' : `Capture Photo ${currentCapture + 1}`}
              </button>
              <button
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

        <button
          onClick={stopCamera}
          className="mt-3 text-xs text-[#656D76] hover:underline"
        >
          Cancel registration
        </button>
      </div>
    </div>
  );
}
