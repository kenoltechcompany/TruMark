import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef } from 'react';
import apiClient from '../../api/client';
import DataTable from '../../components/DataTable';

interface Student {
  id: string;
  fullName: string;
  indexNumber: string;
  imagePaths: string[];
  createdAt: string;
}

interface MyClassData {
  id: string;
  name: string;
  registrationLinkActive: boolean;
  students: Student[];
}

export default function CourseRepDashboardPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  // ── Fetch class data ──
  const { data: classData, isLoading } = useQuery<MyClassData>({
    queryKey: ['my-class'],
    queryFn: () => apiClient.get('/course-rep/my-class').then((r) => r.data),
  });

  // ── Toggle registration ──
  const toggleMutation = useMutation({
    mutationFn: () => apiClient.patch('/course-rep/my-class/toggle-registration'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-class'] }),
  });

  // ── Bulk delete students ──
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.delete('/course-rep/students/bulk', { data: { studentIds: ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-class'] }),
  });

  // ── Copy onboarding link ──
  const copyLink = () => {
    if (classData) {
      const url = `${window.location.origin}/public/register/${classData.id}`;
      navigator.clipboard.writeText(url);
    }
  };

  if (isLoading) {
    return <p className="text-[#656D76]">Loading your class…</p>;
  }

  if (!classData) {
    return <p className="text-[#656D76]">No class assigned yet. Contact an admin.</p>;
  }

  return (
    <div className="space-y-6">
      {/* ── Class Control Panel ── */}
      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#1F2328]">{classData.name}</h2>
            <p className="text-sm text-[#656D76] mt-0.5">
              {classData.students.length} student{classData.students.length !== 1 ? 's' : ''} enrolled
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Toggle switch */}
            <label className="flex items-center gap-2 cursor-pointer">
              <span className="text-sm text-[#656D76]">Registration</span>
              <div
                onClick={() => toggleMutation.mutate()}
                className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer ${
                  classData.registrationLinkActive ? 'bg-[#1F883D]' : 'bg-[#D0D7DE]'
                }`}
              >
                <div
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${
                    classData.registrationLinkActive ? 'translate-x-5' : ''
                  }`}
                />
              </div>
            </label>
            {/* Copy link button */}
            <button
              onClick={copyLink}
              className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
            >
              Copy Onboarding Link
            </button>
          </div>
        </div>
      </div>

      {/* ── Roster Management ── */}
      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2328]">Enrolled Students</h3>
          <button
            onClick={() => setShowModal(true)}
            className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
          >
            + Add Student
          </button>
        </div>

        <DataTable<Student>
          columns={[
            { key: 'fullName', header: 'Full Name' },
            { key: 'indexNumber', header: 'Index Number' },
            {
              key: 'createdAt',
              header: 'Enrolled',
              render: (item) => new Date(item.createdAt).toLocaleDateString(),
            },
          ]}
          data={classData.students}
          keyExtractor={(s) => s.id}
          bulkActionLabel="Delete Selected"
          onBulkAction={(ids) => {
            if (confirm(`Delete ${ids.length} student(s)?`)) bulkDeleteMutation.mutate(ids);
          }}
        />
      </div>

      {/* ── Manual Onboarding Modal ── */}
      {showModal && (
        <ManualOnboardingModal
          classId={classData.id}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            queryClient.invalidateQueries({ queryKey: ['my-class'] });
          }}
        />
      )}
    </div>
  );
}

// ──────────────────────────────────────────
// Manual Onboarding Modal (with webcam capture)
// ──────────────────────────────────────────

function ManualOnboardingModal({
  classId,
  onClose,
  onSuccess,
}: {
  classId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [fullName, setFullName] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [step, setStep] = useState<'form' | 'capture' | 'submitting'>('form');
  const [capturedImages, setCapturedImages] = useState<Blob[]>([]);
  const [currentCapture, setCurrentCapture] = useState(0);
  const [error, setError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Start webcam
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStep('capture');
    } catch {
      setError('Could not access camera. Please ensure camera permissions are granted.');
    }
  };

  // Capture current frame
  const snapPhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (blob) {
        setCapturedImages((prev) => [...prev, blob]);
        if (currentCapture >= 2) {
          // All 3 captured — stop camera and submit
          stopCamera();
          setStep('submitting');
          submitForm([...capturedImages, blob]);
        } else {
          setCurrentCapture((c) => c + 1);
        }
      }
    }, 'image/jpeg');
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const submitForm = async (images: Blob[]) => {
    setError('');
    try {
      const formData = new FormData();
      formData.append('fullName', fullName);
      formData.append('indexNumber', indexNumber);
      images.forEach((img) => formData.append('images', img, `capture.jpg`));

      await apiClient.post('/course-rep/students', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to register student.');
      setStep('capture');
      setCurrentCapture(0);
      setCapturedImages([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-sm p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2328]">Register Student</h3>
          <button onClick={onClose} className="text-[#656D76] hover:text-[#1F2328] text-lg leading-none">&times;</button>
        </div>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        {step === 'form' && (
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
              Next — Capture Photos
            </button>
          </form>
        )}

        {step === 'capture' && (
          <div className="space-y-3">
            <p className="text-sm text-[#656D76]">
              Photo {currentCapture + 1} of 3 — Look at the camera
            </p>
            <video ref={videoRef} autoPlay playsInline className="w-full rounded-md bg-black" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-2">
              <button
                onClick={snapPhoto}
                className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
              >
                Capture Photo {currentCapture + 1}
              </button>
              <button
                onClick={() => {
                  stopCamera();
                  setCapturedImages([]);
                  setCurrentCapture(0);
                  setStep('form');
                }}
                className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
              >
                Back
              </button>
            </div>
          </div>
        )}

        {step === 'submitting' && (
          <p className="text-sm text-[#656D76]">Submitting student data…</p>
        )}
      </div>
    </div>
  );
}
