import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useRef, useEffect } from 'react';
import apiClient from '../../api/client';
import DataTable from '../../components/DataTable';
import CsvImportModal from '../../components/CsvImportModal';

interface Student {
  id: string;
  fullName: string;
  indexNumber: string;
  imagePaths: string[];
  azurePersonId?: string | null;
  faceEmbedding?: number[] | null;
  createdAt: string;
  courseRep?: {
    id: string;
    studentId?: string | null;
    username: string;
  } | null;
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
  const [showImportCsv, setShowImportCsv] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  // ── Delete single student ──
  const singleDeleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/course-rep/students/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-class'] }),
  });

  // ── Bulk delete students ──
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.delete('/course-rep/students/bulk', { data: { studentIds: ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-class'] }),
  });

  // ── Sync to Azure ──
  const syncMutation = useMutation({
    mutationFn: () => apiClient.post('/course-rep/my-class/sync'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-class'] }),
  });

  // ── Copy onboarding link ──
  const copyLink = () => {
    if (classData) {
      const url = `${window.location.origin}/public/register/${classData.id}`;
      navigator.clipboard.writeText(url);
      alert('Copied onboarding link to clipboard!');
    }
  };

  if (isLoading) {
    return <p className="text-[#656D76]">Loading your class…</p>;
  }

  if (!classData) {
    return <p className="text-[#656D76]">No class assigned yet. Contact an administrator.</p>;
  }

  const isStudentSynced = (s: Student) =>
    Boolean(s.azurePersonId || (s.faceEmbedding && s.faceEmbedding.length > 0));

  const unsyncedCount = classData.students.filter((s) => !isStudentSynced(s)).length;

  const filteredStudents = searchTerm.trim()
    ? classData.students.filter(
        (s) =>
          s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          s.indexNumber.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    : classData.students;

  return (
    <div className="space-y-6">
      {/* ── Class Control Panel ── */}
      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[#1F2328]">{classData.name}</h2>
            <p className="text-sm text-[#656D76] mt-0.5">
              {classData.students.length} student{classData.students.length !== 1 ? 's' : ''} enrolled
              {unsyncedCount > 0 && ` (${unsyncedCount} pending biometric sync)`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Toggle switch */}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-sm text-[#656D76]">Self-Registration</span>
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
              Copy Student Link
            </button>
            {/* Sync Face Biometrics button */}
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || unsyncedCount === 0}
              className="bg-[#1F883D] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#1A7F37] transition-colors disabled:opacity-50"
            >
              {syncMutation.isPending
                ? 'Syncing Biometrics…'
                : `Sync ${unsyncedCount > 0 ? `(${unsyncedCount})` : ''} Biometrics`}
            </button>
          </div>
        </div>
      </div>

      {/* ── Roster Management ── */}
      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="text-base font-semibold text-[#1F2328]">Enrolled Students</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportCsv(true)}
              className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
            >
              Import CSV
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
            >
              + Add Student
            </button>
          </div>
        </div>

        <DataTable<Student>
          columns={[
            {
              key: 'fullName',
              header: 'Full Name',
              render: (item) => (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#1F2328]">{item.fullName}</span>
                  {item.courseRep && (
                    <span className="bg-[#DDF4FF] text-[#0969DA] border border-[#54AEFF] text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      Course Rep
                    </span>
                  )}
                </div>
              ),
            },
            { key: 'indexNumber', header: 'Index Number' },
            {
              key: 'createdAt',
              header: 'Enrolled',
              render: (item) => new Date(item.createdAt).toLocaleDateString(),
            },
            {
              key: 'azurePersonId',
              header: 'Biometric Status',
              render: (item) => {
                const synced = isStudentSynced(item);
                return (
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded ${
                      synced
                        ? 'bg-[#E6F6EC] text-[#1F883D]'
                        : 'bg-[#FFF8E5] text-[#9A6700]'
                    }`}
                  >
                    {synced ? 'Face Model Ready' : 'Pending Sync'}
                  </span>
                );
              },
            },
            {
              key: 'actions',
              header: 'Actions',
              sortable: false,
              render: (item) => (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingStudent(item)}
                    className="text-[#0969DA] hover:underline text-sm font-medium"
                  >
                    Edit
                  </button>
                  <span className="text-[#D0D7DE]">|</span>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Delete "${item.fullName}" (${item.indexNumber}) from this class?`,
                        )
                      ) {
                        singleDeleteMutation.mutate(item.id);
                      }
                    }}
                    className="text-[#D73A49] hover:underline text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              ),
            },
          ]}
          data={classData.students}
          keyExtractor={(s) => s.id}
          bulkActionLabel="Delete Selected"
          onBulkAction={(ids) => {
            if (confirm(`Delete ${ids.length} student(s)?`)) {
              bulkDeleteMutation.mutate(ids);
            }
          }}
        />
      </div>

      {/* ── Edit Student Modal ── */}
      {editingStudent && (
        <EditClassStudentModal
          student={editingStudent}
          onClose={() => setEditingStudent(null)}
          onSuccess={() => {
            setEditingStudent(null);
            queryClient.invalidateQueries({ queryKey: ['my-class'] });
          }}
        />
      )}

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

      {/* ── Import CSV Modal ── */}
      {showImportCsv && (
        <CsvImportModal
          classId={classData.id}
          title={`Import CSV to ${classData.name}`}
          apiEndpoint="/course-rep/my-class/students/import-csv"
          onClose={() => setShowImportCsv(false)}
          onSuccess={() => {
            setShowImportCsv(false);
            queryClient.invalidateQueries({ queryKey: ['my-class'] });
          }}
        />
      )}
    </div>
  );
}

function EditClassStudentModal({
  student,
  onClose,
  onSuccess,
}: {
  student: Student;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [fullName, setFullName] = useState(student.fullName);
  const [indexNumber, setIndexNumber] = useState(student.indexNumber);
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      apiClient.patch(`/course-rep/students/${student.id}`, data),
    onSuccess: () => onSuccess(),
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to update student');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ fullName, indexNumber });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2328]">Edit Student Details</h3>
          <button
            onClick={onClose}
            className="text-[#656D76] hover:text-[#1F2328] text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#D73A49] px-3 py-2 rounded-md text-xs mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-[#656D76] mb-1">Full Name</label>
            <input
              type="text"
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
              value={indexNumber}
              onChange={(e) => setIndexNumber(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────
// Manual Onboarding Modal (with webcam capture)
// ──────────────────────────────────────────

function ManualOnboardingModal({
  classId: _classId,
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

  useEffect(() => {
    if (step === 'capture' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [step]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  // Start webcam
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
    } catch {
      setError('Could not access webcam. Please ensure permissions are granted.');
    }
  };

  // Stop webcam
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Capture single photo from webcam
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const newImages = [...capturedImages, blob];
        setCapturedImages(newImages);
        if (newImages.length === 3) {
          stopCamera();
          submitStudent(newImages);
        } else {
          setCurrentCapture(newImages.length);
        }
      },
      'image/jpeg',
      0.9,
    );
  };

  // Submit student with 3 captured images
  const submitStudent = async (images: Blob[]) => {
    setStep('submitting');
    setError('');

    const formData = new FormData();
    formData.append('fullName', fullName);
    formData.append('indexNumber', indexNumber);
    images.forEach((img, idx) => {
      formData.append('images', img, `capture_${idx + 1}.jpg`);
    });

    try {
      await apiClient.post('/course-rep/students', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to enroll student.');
      setStep('form');
      setCapturedImages([]);
      setCurrentCapture(0);
    }
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setStep('capture');
    startCamera();
  };

  const handleClose = () => {
    stopCamera();
    onClose();
  };

  const prompts = [
    'Look straight at the camera',
    'Tilt your head slightly to the left',
    'Tilt your head slightly to the right',
  ];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-sm p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2328]">
            {step === 'form' ? 'Enroll New Student' : 'Capture Biometrics'}
          </h3>
          <button
            onClick={handleClose}
            className="text-[#656D76] hover:text-[#1F2328] text-lg leading-none"
          >
            &times;
          </button>
        </div>

        {error && (
          <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#D73A49] px-3 py-2 rounded-md text-xs mb-3">
            {error}
          </div>
        )}

        {step === 'form' && (
          <form onSubmit={handleNextStep} className="space-y-3">
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. John Doe"
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
                placeholder="e.g. 10293847"
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
              >
                Next: Take Photos
              </button>
            </div>
          </form>
        )}

        {step === 'capture' && (
          <div className="space-y-3 text-center">
            <p className="text-sm font-medium text-[#1F2328]">
              Photo {currentCapture + 1} of 3: {prompts[currentCapture]}
            </p>
            <div className="relative w-full aspect-video bg-black rounded-md overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={capturePhoto}
                className="bg-[#1F883D] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#1A7F37] transition-colors"
              >
                Capture Photo ({currentCapture + 1}/3)
              </button>
            </div>
          </div>
        )}

        {step === 'submitting' && (
          <div className="py-8 text-center space-y-2">
            <p className="text-sm text-[#656D76]">Uploading biometrics and registering student…</p>
          </div>
        )}
      </div>
    </div>
  );
}
