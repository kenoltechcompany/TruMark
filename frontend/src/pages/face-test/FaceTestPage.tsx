import { useState, useRef, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import {
  Camera,
  CheckCircle2,
  XCircle,
  Upload,
  RotateCcw,
  Loader2,
  ShieldCheck,
  ArrowLeft,
} from 'lucide-react';

interface DetectResult {
  provider: string;
  detected: boolean;
  faceCount: number;
  faceToken: string | null;
  message: string;
}

interface CompareResult {
  provider: string;
  matched: boolean;
  confidence: number;
  requiredThreshold: number;
  message: string;
}

export default function FaceTestPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');

  const [refPreview, setRefPreview] = useState<string | null>(null);
  const [refDetect, setRefDetect] = useState<DetectResult | null>(null);
  const [detectLoading, setDetectLoading] = useState(false);

  const [probePreview, setProbePreview] = useState<string | null>(null);
  const [compareResult, setCompareResult] = useState<CompareResult | null>(null);
  const [compareLatencyMs, setCompareLatencyMs] = useState<number | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [error, setError] = useState('');

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setCameraReady(true);
    } catch {
      setCameraError('Camera unavailable. You can still upload two photos below.');
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  const captureFrameBlob = async (): Promise<Blob | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !cameraReady) return null;
    const rawW = video.videoWidth || 640;
    const rawH = video.videoHeight || 480;
    const scale = Math.min(1, 640 / Math.max(rawW, rawH));
    canvas.width = Math.round(rawW * scale);
    canvas.height = Math.round(rawH * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85),
    );
  };

  const runDetect = async (fileOrBlob: Blob) => {
    setError('');
    setCompareResult(null);
    setProbePreview(null);
    setDetectLoading(true);
    setRefPreview(URL.createObjectURL(fileOrBlob));
    try {
      const fd = new FormData();
      fd.append('image', fileOrBlob, 'reference.jpg');
      const res = await apiClient.post<DetectResult>('/public/face-test/detect', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 45000,
      });
      setRefDetect(res.data);
    } catch (err: any) {
      setRefDetect(null);
      setError(err.response?.data?.message || err.message || 'Face detection test failed.');
    } finally {
      setDetectLoading(false);
    }
  };

  const runCompare = async (fileOrBlob: Blob) => {
    if (!refDetect?.faceToken) {
      setError('Capture or upload a valid Reference Face in Step 1 first.');
      return;
    }
    setError('');
    setCompareLoading(true);
    setProbePreview(URL.createObjectURL(fileOrBlob));
    const started = performance.now();
    try {
      const fd = new FormData();
      fd.append('faceToken1', refDetect.faceToken);
      fd.append('image', fileOrBlob, 'probe.jpg');
      const res = await apiClient.post<CompareResult>('/public/face-test/compare', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 45000,
      });
      setCompareLatencyMs(Math.round(performance.now() - started));
      setCompareResult(res.data);
    } catch (err: any) {
      setCompareResult(null);
      setError(err.response?.data?.message || err.message || 'Face comparison test failed.');
    } finally {
      setCompareLoading(false);
    }
  };

  const handleReset = () => {
    setRefPreview(null);
    setRefDetect(null);
    setProbePreview(null);
    setCompareResult(null);
    setCompareLatencyMs(null);
    setError('');
  };

  return (
    <div className="min-h-screen bg-[#EEF2F6] text-[#1F2328] flex flex-col">
      <header className="bg-white border-b border-[#D0D7DE] px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to="/check-in"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#656D76] hover:text-[#1F2328]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Check-In</span>
          </Link>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F883D] bg-[#E6F6EC] border border-[#34D058]/60 px-3 py-1 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Isolated Face++ Test Lab</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 space-y-5">
        <div className="text-center space-y-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
            Facial Recognition Diagnostic Lab
          </h1>
          <p className="text-xs sm:text-sm text-[#656D76]">
            Test Face++ detection and 1:1 matching independently from classes, sessions, or GPS.
          </p>
        </div>

        {error && (
          <div role="alert" className="clay-error-card p-2 animate-enter">
            <div className="clay-error-banner text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold">
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Test Error</span>
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="clay-btn bg-white text-[#CF222E] px-3 py-1 text-[11px] font-bold cursor-pointer"
              >
                Reset
              </button>
            </div>
            <div className="px-4 py-3 text-xs font-medium text-[#B71C1C]">{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Live Camera Viewfinder */}
          <div className="bg-white border border-[#D0D7DE] rounded-2xl p-4 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-[#656D76]">
                Live Camera
              </span>
              <span className="text-[11px] text-[#656D76]">
                {cameraReady ? 'Ready' : cameraError || 'Starting...'}
              </span>
            </div>

            <div className="relative w-full aspect-[4/3] bg-[#0D1117] rounded-xl overflow-hidden border border-[#1F2328] flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />
              <canvas ref={canvasRef} className="hidden" />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-40 h-52 rounded-full border-2 border-dashed border-[#34D058]/80" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!cameraReady || detectLoading}
                onClick={async () => {
                  const blob = await captureFrameBlob();
                  if (blob) runDetect(blob);
                }}
                className="clay-btn bg-[#0969DA] text-white py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {detectLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
                <span>1. Set Reference</span>
              </button>

              <button
                type="button"
                disabled={!cameraReady || !refDetect?.faceToken || compareLoading}
                onClick={async () => {
                  const blob = await captureFrameBlob();
                  if (blob) runCompare(blob);
                }}
                className="clay-btn bg-[#1F883D] text-white py-2.5 px-3 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer"
              >
                {compareLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                <span>2. Verify Match</span>
              </button>
            </div>
          </div>

          {/* Step Results & File Upload Fallback */}
          <div className="space-y-4">
            {/* Step 1 Status */}
            <div className="bg-white border border-[#D0D7DE] rounded-2xl p-4 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold uppercase tracking-wider text-[#656D76]">
                  Step 1 — Reference Detection
                </h2>
                <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0969DA] cursor-pointer hover:underline">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) runDetect(f);
                    }}
                  />
                </label>
              </div>

              {refPreview && (
                <div className="flex items-center gap-3">
                  <img
                    src={refPreview}
                    alt="Reference"
                    className="w-16 h-16 rounded-xl object-cover border border-[#D0D7DE]"
                  />
                  <div className="text-xs space-y-1">
                    {refDetect ? (
                      <>
                        <p
                          className={`font-bold ${
                            refDetect.detected ? 'text-[#1F883D]' : 'text-[#CF222E]'
                          }`}
                        >
                          {refDetect.message}
                        </p>
                        {refDetect.faceToken && (
                          <p className="font-mono text-[11px] text-[#656D76]">
                            Token: {refDetect.faceToken.slice(0, 14)}...
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-[#656D76]">Running Face++ /detect...</p>
                    )}
                  </div>
                </div>
              )}

              {!refPreview && (
                <p className="text-xs text-[#656D76]">
                  Center your face in the oval and click <strong>1. Set Reference</strong> (or upload a photo).
                </p>
              )}
            </div>

            {/* Step 2 Claymorphic Result */}
            {compareResult && (
              <div
                className={
                  compareResult.matched
                    ? 'clay-success-card p-3 animate-enter'
                    : 'clay-error-card p-2.5 animate-enter'
                }
              >
                <div
                  className={
                    compareResult.matched
                      ? 'clay-success-banner text-white px-4 py-4 text-center'
                      : 'clay-error-banner text-white px-4 py-4 text-center'
                  }
                >
                  <div className="flex items-center justify-center gap-2 font-extrabold text-base">
                    {compareResult.matched ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <XCircle className="w-5 h-5" />
                    )}
                    <span>
                      {compareResult.matched ? 'Face Matched!' : 'Face Did Not Match'}
                    </span>
                  </div>
                  <p className="text-xs text-white/90 mt-1">{compareResult.message}</p>
                </div>

                <div className="p-3.5 flex items-center justify-between text-xs">
                  {probePreview && (
                    <img
                      src={probePreview}
                      alt="Probe"
                      className="w-12 h-12 rounded-xl object-cover border border-[#D0D7DE]"
                    />
                  )}
                  <div className="text-right space-y-0.5">
                    <p className="font-bold text-[#1F2328]">
                      Score: {compareResult.confidence}% (Threshold: {compareResult.requiredThreshold}%)
                    </p>
                    {compareLatencyMs !== null && (
                      <p className="text-[11px] text-[#656D76]">
                        Latency: {compareLatencyMs} ms ({compareResult.provider})
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="clay-btn bg-white text-[#1F2328] px-3 py-1.5 text-[11px] font-bold border border-[#D0D7DE] cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {!compareResult && (
              <div className="bg-white border border-[#D0D7DE] rounded-2xl p-4 space-y-2 shadow-xs">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold uppercase tracking-wider text-[#656D76]">
                    Step 2 — 1:1 Face Comparison
                  </h2>
                  <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0969DA] cursor-pointer hover:underline">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) runCompare(f);
                      }}
                    />
                  </label>
                </div>
                <p className="text-xs text-[#656D76]">
                  Once Step 1 detects a face, click <strong>2. Verify Match</strong> to see the exact Face++ similarity percentage.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
