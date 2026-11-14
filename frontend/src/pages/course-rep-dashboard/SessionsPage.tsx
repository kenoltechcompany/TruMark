import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Lock,
  Unlock,
  ExternalLink,
  Copy,
  Check,
  QrCode,
  Globe,
  Smartphone,
  Calendar,
  Radio,
  Plus,
  X,
  Download,
  Pencil,
  Trash2,
} from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../../components/DataTable';

interface Classroom {
  id: string;
  name: string;
}

interface Session {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  classroomId: string;
  classroom: { name: string } | null;
  isLocked?: boolean;
  createdAt: string;
}

interface AttendanceRecord {
  id: string;
  student: { id: string; fullName: string; indexNumber: string };
  confidence: number;
  createdAt: string;
}

interface Student {
  id: string;
  fullName: string;
  indexNumber: string;
}

interface MyClassData {
  id: string;
  name: string;
  students: Student[];
}

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [qrModalSession, setQrModalSession] = useState<Session | null>(null);

  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [createError, setCreateError] = useState('');
  const [attendanceViewTab, setAttendanceViewTab] = useState<'present' | 'absent'>('present');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Fetch all classrooms for the dropdown
  const { data: classrooms = [] } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: () => apiClient.get('/classrooms').then((r) => r.data),
  });

  // Fetch sessions
  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ['my-sessions'],
    queryFn: () => apiClient.get('/course-rep/sessions').then((r) => r.data),
  });

  // Fetch class students to know who is absent
  const { data: myClass } = useQuery<MyClassData>({
    queryKey: ['my-class'],
    queryFn: () => apiClient.get('/course-rep/my-class').then((r) => r.data),
  });

  // Fetch attendance records for selected session
  const { data: attendance = [] } = useQuery<AttendanceRecord[]>({
    queryKey: ['attendance', selectedSession],
    queryFn: () =>
      apiClient
        .get(`/course-rep/sessions/${selectedSession}/attendance`)
        .then((r) => r.data),
    enabled: !!selectedSession,
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      startTime: string;
      endTime: string;
      classroomId: string;
    }) => apiClient.post('/course-rep/sessions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
      setShowForm(false);
      setName('');
      setStartTime('');
      setEndTime('');
      setClassroomId('');
      setCreateError('');
    },
    onError: (err: any) => {
      setCreateError(err.response?.data?.message || 'Failed to create session.');
    },
  });

  const singleDeleteMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.delete(`/course-rep/sessions/${sessionId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-sessions'] }),
  });

  const toggleLockMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.patch(`/course-rep/sessions/${sessionId}/toggle-lock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to toggle session lock.');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.delete('/course-rep/sessions/bulk', { data: { sessionIds: ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-sessions'] }),
  });

  const deleteAttendanceMutation = useMutation({
    mutationFn: ({
      sessionId,
      recordId,
    }: {
      sessionId: string;
      recordId: string;
    }) =>
      apiClient.delete(
        `/course-rep/sessions/${sessionId}/attendance/${recordId}`,
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['attendance', selectedSession] }),
  });

  const manualAttendanceMutation = useMutation({
    mutationFn: ({ sessionId, studentId }: { sessionId: string; studentId: string }) =>
      apiClient.post(`/course-rep/sessions/${sessionId}/attendance/manual`, { studentId }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['attendance', selectedSession] }),
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to record manual attendance.');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    if (!name.trim() || !startTime || !endTime || !classroomId) {
      setCreateError('All fields are required.');
      return;
    }

    createMutation.mutate({
      name: name.trim(),
      classroomId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    });
  };

  const copySessionId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyCheckInLink = (id: string) => {
    const url = `${window.location.origin}/check-in/${id}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  const attendedStudentIds = new Set(attendance.map((a) => a.student.id));
  const absentStudents = (myClass?.students || []).filter(
    (s) => !attendedStudentIds.has(s.id),
  );

  const now = new Date();
  const activeCount = sessions.filter((s) => {
    if (s.isLocked) return false;
    const start = new Date(s.startTime);
    const end = new Date(s.endTime);
    return now >= start && now <= end;
  }).length;
  const lockedCount = sessions.filter((s) => Boolean(s.isLocked)).length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1F2328]">Class Sessions</h2>
          <p className="text-xs sm:text-sm text-[#656D76] mt-0.5">
            Create lecture sessions, broadcast QR codes, and audit live classroom attendance.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setCreateError('');
          }}
          className="inline-flex items-center gap-1.5 bg-[#0969DA] text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors cursor-pointer self-start sm:self-auto"
        >
          {showForm ? (
            <>
              <X className="w-3.5 h-3.5" />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Plus className="w-3.5 h-3.5" />
              <span>New Session</span>
            </>
          )}
        </button>
      </div>

      {/* ── Tactile Summary Gauges ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Total Sessions
            </span>
            <div className="text-2xl font-bold text-[#1F2328] mt-1 font-mono">
              {sessions.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA]">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Active / Live Now
            </span>
            <div className="text-2xl font-bold text-[#1F883D] mt-1 font-mono">
              {activeCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#1F883D]">
            <Radio className="w-5 h-5" />
          </div>
        </div>

        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Locked Sessions
            </span>
            <div className="text-2xl font-bold text-[#1F2328] mt-1 font-mono">
              {lockedCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#CF222E]">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Create Session Form ── */}
      {showForm && (
        <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 max-w-2xl shadow-xs animate-enter">
          <div className="border-b border-[#E1E4E8] pb-3 mb-4">
            <h3 className="text-sm font-bold text-[#1F2328]">
              Schedule a New Lecture Session
            </h3>
            <p className="text-xs text-[#656D76]">
              Select a geofenced classroom and define the attendance check-in time window.
            </p>
          </div>

          {createError && (
            <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#CF222E] px-3 py-2 rounded-lg text-xs mb-3">
              {createError}
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
                  Session Name / Topic
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Week 4: Distributed Consensus"
                  className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
                  Classroom / Lecture Hall
                </label>
                <select
                  value={classroomId}
                  onChange={(e) => setClassroomId(e.target.value)}
                  className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                >
                  <option value="">Select a classroom...</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#1F2328] px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#EAEEF2] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-[#0969DA] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors disabled:opacity-50 cursor-pointer"
              >
                {createMutation.isPending ? 'Scheduling...' : 'Schedule Session'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Sessions List ── */}
      <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-xs">
        <DataTable<Session>
          columns={[
            {
              key: 'name',
              header: 'Session Name',
              render: (item) => (
                <span className="font-semibold text-[#1F2328]">{item.name}</span>
              ),
            },
            {
              key: 'classroom',
              header: 'Classroom',
              render: (item) => (
                <span className="text-xs font-medium text-[#1F2328]">
                  {item.classroom?.name || '-'}
                </span>
              ),
            },
            {
              key: 'startTime',
              header: 'Time Window',
              render: (item) => {
                const s = new Date(item.startTime);
                const e = new Date(item.endTime);
                return (
                  <span className="text-xs font-mono text-[#656D76]">
                    {s.toLocaleDateString()}{' '}
                    {s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
                    {e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                );
              },
            },
            {
              key: 'isLocked',
              header: 'Attendance Lock',
              render: (item) => {
                const locked = Boolean(item.isLocked);
                return (
                  <button
                    type="button"
                    onClick={() => toggleLockMutation.mutate(item.id)}
                    disabled={toggleLockMutation.isPending}
                    title={
                      locked
                        ? 'Attendance is locked. Click to unlock.'
                        : 'Attendance is open to scheduled time window. Click to lock.'
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all cursor-pointer ${
                      locked
                        ? 'bg-[#FFEBE9] text-[#CF222E] border-[#FF8182] hover:bg-[#FFD1CE]'
                        : 'bg-[#F6F8FA] text-[#1F883D] border-[#D0D7DE] hover:bg-[#E6F6EC]'
                    }`}
                  >
                    {locked ? (
                      <>
                        <Lock className="w-3.5 h-3.5" />
                        <span>Locked</span>
                      </>
                    ) : (
                      <>
                        <Unlock className="w-3.5 h-3.5 text-[#1F883D]" />
                        <span>Unlocked</span>
                      </>
                    )}
                  </button>
                );
              },
            },
            {
              key: 'status',
              header: 'Status',
              render: (item) => {
                if (item.isLocked) {
                  return (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FFEBE9] text-[#CF222E] border border-[#FF8182]/50">
                      Locked
                    </span>
                  );
                }
                const current = new Date();
                const start = new Date(item.startTime);
                const end = new Date(item.endTime);
                const isActive = current >= start && current <= end;
                const isPast = current > end;
                return (
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                      isActive
                        ? 'bg-[#E6F6EC] text-[#1F883D] border border-[#34D058]/60'
                        : isPast
                        ? 'bg-[#F6F8FA] text-[#656D76] border border-[#D0D7DE]'
                        : 'bg-[#DDF4FF] text-[#0969DA]'
                    }`}
                  >
                    {isActive ? '● Live Now' : isPast ? 'Completed' : 'Upcoming'}
                  </span>
                );
              },
            },
            {
              key: 'actions',
              header: 'Actions',
              sortable: false,
              render: (item) => (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      setSelectedSession(item.id);
                      setAttendanceViewTab('present');
                    }}
                    className="text-[#0969DA] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    Attendance
                  </button>
                  <span className="text-[#D0D7DE]">|</span>
                  <button
                    onClick={() => setQrModalSession(item)}
                    className="inline-flex items-center gap-1 text-[#0969DA] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    <QrCode className="w-3 h-3" />
                    <span>QR</span>
                  </button>
                  <span className="text-[#D0D7DE]">|</span>
                  <button
                    onClick={() => copyCheckInLink(item.id)}
                    className="inline-flex items-center gap-1 text-[#0969DA] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    {copiedLink === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-[#1F883D]" />
                        <span className="text-[#1F883D]">Copied Link</span>
                      </>
                    ) : (
                      <span>Copy Link</span>
                    )}
                  </button>
                  <span className="text-[#D0D7DE]">|</span>
                  <button
                    onClick={() => copySessionId(item.id)}
                    className="inline-flex items-center gap-1 text-[#0969DA] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    {copiedId === item.id ? (
                      <>
                        <Check className="w-3 h-3 text-[#1F883D]" />
                        <span className="text-[#1F883D]">Copied ID</span>
                      </>
                    ) : (
                      <span>Copy ID</span>
                    )}
                  </button>
                  <span className="text-[#D0D7DE]">|</span>
                  <button
                    onClick={() => setEditingSession(item)}
                    className="inline-flex items-center gap-1 text-[#0969DA] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <span className="text-[#D0D7DE]">|</span>
                  <button
                    onClick={() => {
                      if (confirm(`Delete session "${item.name}"?`)) {
                        singleDeleteMutation.mutate(item.id);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[#CF222E] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
                  </button>
                </div>
              ),
            },
          ]}
          data={sessions}
          loading={isLoading}
          keyExtractor={(s) => s.id}
          bulkActionLabel="Delete Selected"
          onBulkAction={(ids) => {
            if (confirm(`Delete ${ids.length} session(s)?`)) {
              bulkDeleteMutation.mutate(ids);
            }
          }}
        />
      </div>

      {/* ── Attendance Modal with Manual Marking ── */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#D0D7DE] rounded-xl shadow-lg p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto animate-enter">
            <div className="flex items-center justify-between mb-4 border-b border-[#E1E4E8] pb-3.5">
              <div>
                <h3 className="text-base font-bold text-[#1F2328]">
                  Session Attendance Audit
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[#1F883D] font-semibold">
                    {attendance.length} Verified Present
                  </span>
                  <span className="text-xs text-[#656D76]">|</span>
                  <span className="text-xs text-[#CF222E] font-semibold">
                    {absentStudents.length} Absent
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const token = localStorage.getItem('token');
                    fetch(`/api/course-rep/sessions/${selectedSession}/export`, {
                      headers: { Authorization: `Bearer ${token}` },
                    })
                      .then((r) => r.blob())
                      .then((blob) => {
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `attendance_${selectedSession}.csv`;
                        a.click();
                        URL.revokeObjectURL(url);
                      });
                  }}
                  className="inline-flex items-center gap-1.5 bg-[#1F883D] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#1A7F37] transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="text-[#656D76] hover:text-[#1F2328] p-1 rounded-md hover:bg-[#F6F8FA] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Attendance Tabs: Selective Neumorphic Segmented Track */}
            <div className="mb-4">
              <div
                role="tablist"
                aria-label="Attendance status filter"
                className="neu-track gap-1 text-xs"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={attendanceViewTab === 'present'}
                  onClick={() => setAttendanceViewTab('present')}
                  className={`neu-tab px-4 py-1.5 font-semibold cursor-pointer ${
                    attendanceViewTab === 'present' ? 'active text-[#0969DA]' : ''
                  }`}
                >
                  Present Students ({attendance.length})
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={attendanceViewTab === 'absent'}
                  onClick={() => setAttendanceViewTab('absent')}
                  className={`neu-tab px-4 py-1.5 font-semibold cursor-pointer ${
                    attendanceViewTab === 'absent' ? 'active text-[#0969DA]' : ''
                  }`}
                >
                  Absent Students ({absentStudents.length})
                </button>
              </div>
            </div>

            {attendanceViewTab === 'present' ? (
              <DataTable<AttendanceRecord>
                columns={[
                  {
                    key: 'student',
                    header: 'Name',
                    render: (item) => (
                      <span className="font-semibold text-[#1F2328]">
                        {item.student.fullName}
                      </span>
                    ),
                  },
                  {
                    key: 'indexNumber',
                    header: 'Index No.',
                    render: (item) => (
                      <span className="font-mono text-xs">{item.student.indexNumber}</span>
                    ),
                  },
                  {
                    key: 'confidence',
                    header: 'Verification Method',
                    render: (item) => (
                      <span className="inline-block bg-[#E6F6EC] text-[#1F883D] border border-[#34D058]/50 font-mono text-xs px-2 py-0.5 rounded-md">
                        {item.confidence >= 1.0
                          ? 'Manual Override'
                          : `Face++: ${(item.confidence * 100).toFixed(1)}%`}
                      </span>
                    ),
                  },
                  {
                    key: 'createdAt',
                    header: 'Checked In',
                    render: (item) => new Date(item.createdAt).toLocaleTimeString(),
                  },
                  {
                    key: 'id',
                    header: '',
                    render: (item) => (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Remove attendance record for ${item.student.fullName}?`,
                            )
                          ) {
                            deleteAttendanceMutation.mutate({
                              sessionId: selectedSession,
                              recordId: item.id,
                            });
                          }
                        }}
                        className="text-[#CF222E] hover:underline text-xs font-semibold cursor-pointer"
                      >
                        Remove
                      </button>
                    ),
                  },
                ]}
                data={attendance}
                keyExtractor={(a) => a.id}
                emptyMessage="No students have checked in to this session yet."
              />
            ) : (
              <DataTable<Student>
                columns={[
                  {
                    key: 'fullName',
                    header: 'Full Name',
                    render: (item) => (
                      <span className="font-semibold text-[#1F2328]">{item.fullName}</span>
                    ),
                  },
                  {
                    key: 'indexNumber',
                    header: 'Index Number',
                    render: (item) => (
                      <span className="font-mono text-xs">{item.indexNumber}</span>
                    ),
                  },
                  {
                    key: 'id',
                    header: 'Action',
                    render: (item) => (
                      <button
                        onClick={() => {
                          manualAttendanceMutation.mutate({
                            sessionId: selectedSession,
                            studentId: item.id,
                          });
                        }}
                        disabled={manualAttendanceMutation.isPending}
                        className="bg-[#1F883D] text-white px-3 py-1 rounded-md text-xs font-semibold hover:bg-[#1A7F37] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Mark Present
                      </button>
                    ),
                  },
                ]}
                data={absentStudents}
                keyExtractor={(s) => s.id}
                emptyMessage="All enrolled students are present!"
              />
            )}
          </div>
        </div>
      )}

      {/* ── Offline QR Code Modal (Powered by qrcode.react) ── */}
      {qrModalSession && (
        <QrCodeModal
          session={qrModalSession}
          onClose={() => setQrModalSession(null)}
        />
      )}

      {/* ── Edit Session Modal ── */}
      {editingSession && (
        <EditSessionModal
          session={editingSession}
          classrooms={classrooms}
          onClose={() => setEditingSession(null)}
          onSuccess={() => {
            setEditingSession(null);
            queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
          }}
        />
      )}
    </div>
  );
}

function QrCodeModal({
  session,
  onClose,
}: {
  session: Session;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'web' | 'mobile'>('web');
  const [copiedWeb, setCopiedWeb] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const checkInUrl = `${window.location.origin}/check-in/${session.id}`;
  const mobilePayload = JSON.stringify({
    type: 'trumark_session',
    sessionId: session.id,
    sessionName: session.name,
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-xl shadow-2xl p-6 w-full max-w-md text-center animate-enter">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg neu-raised flex items-center justify-center text-[#0969DA]">
              <QrCode className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#1F2328]">
              Broadcast Session QR
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#656D76] hover:text-[#1F2328] p-1 rounded-md hover:bg-[#F6F8FA] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tactile Segmented Track for Web vs Mobile */}
        <div className="mb-3">
          <div className="neu-track w-full grid grid-cols-2 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('web')}
              className={`neu-tab py-1.5 flex items-center justify-center gap-1.5 font-semibold cursor-pointer ${
                activeTab === 'web' ? 'active text-[#0969DA]' : ''
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Web Check-In</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('mobile')}
              className={`neu-tab py-1.5 flex items-center justify-center gap-1.5 font-semibold cursor-pointer ${
                activeTab === 'mobile' ? 'active text-[#0969DA]' : ''
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Mobile App</span>
            </button>
          </div>
        </div>

        <p className="text-xs text-[#656D76] mb-3">
          {activeTab === 'web'
            ? 'Students scan with their phone camera to open Web Attendance in browser.'
            : 'Students scan directly inside the TruMark Mobile Application.'}
        </p>

        {/* Pure Client-Side Zero-Network SVG Rendering */}
        <div className="inline-block p-4 bg-white border border-[#D0D7DE] rounded-xl shadow-xs mb-4">
          <QRCodeSVG
            value={activeTab === 'web' ? checkInUrl : mobilePayload}
            size={210}
            level="M"
          />
        </div>

        <div className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-xl p-3 mb-4 text-left">
          <div className="text-[10px] text-[#656D76] font-semibold uppercase tracking-wider mb-0.5">
            Active Session
          </div>
          <div className="text-sm font-bold text-[#1F2328] mb-0.5">
            {session.name}
          </div>
          <div className="text-xs font-mono text-[#656D76] break-all select-all">
            ID: {session.id}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(checkInUrl);
                setCopiedWeb(true);
                setTimeout(() => setCopiedWeb(false), 2000);
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#0969DA] text-white py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors cursor-pointer"
            >
              {copiedWeb ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedWeb ? 'Copied Web Link!' : 'Copy Web Check-In Link'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.open(checkInUrl, '_blank')}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F6F8FA] border border-[#D0D7DE] text-[#1F2328] rounded-lg text-xs font-semibold hover:bg-[#EAEEF2] cursor-pointer"
              title="Open Web Check-In in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open</span>
            </button>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(session.id);
                setCopiedId(true);
                setTimeout(() => setCopiedId(false), 2000);
              }}
              className="flex-1 bg-[#F6F8FA] border border-[#D0D7DE] text-[#1F2328] py-1.5 rounded-lg text-xs font-semibold hover:bg-[#EAEEF2] cursor-pointer"
            >
              {copiedId ? 'Copied Session ID!' : 'Copy Raw Session ID'}
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#1F2328] px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#EAEEF2] cursor-pointer"
            >
              Print QR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditSessionModal({
  session,
  classrooms,
  onClose,
  onSuccess,
}: {
  session: Session;
  classrooms: Classroom[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(session.name);
  const [classroomId, setClassroomId] = useState(session.classroomId || '');
  const [startTime, setStartTime] = useState(
    new Date(session.startTime).toISOString().slice(0, 16),
  );
  const [endTime, setEndTime] = useState(
    new Date(session.endTime).toISOString().slice(0, 16),
  );
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: {
      name: string;
      classroomId: string;
      startTime: string;
      endTime: string;
    }) => apiClient.patch(`/course-rep/sessions/${session.id}`, data),
    onSuccess: () => onSuccess(),
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to update session');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      name: name.trim(),
      classroomId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-xl shadow-lg p-6 w-full max-w-lg animate-enter">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg neu-raised flex items-center justify-center text-[#0969DA]">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#1F2328]">
              Edit Session
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#656D76] hover:text-[#1F2328] p-1 rounded-md hover:bg-[#F6F8FA] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#CF222E] px-3 py-2 rounded-lg text-xs mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#1F2328] mb-1">
              Session Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1F2328] mb-1">
              Classroom
            </label>
            <select
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
              required
            >
              {classrooms.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                End Time
              </label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E4E8]">
            <button
              type="button"
              onClick={onClose}
              className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#1F2328] px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#EAEEF2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="bg-[#0969DA] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
