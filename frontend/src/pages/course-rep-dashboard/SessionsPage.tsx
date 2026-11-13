import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Lock, Unlock, ExternalLink, Copy, QrCode, Globe, Smartphone, Bot } from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../../components/DataTable';
import OnlineAttendanceModal from '../../components/OnlineAttendanceModal';

interface Classroom {
  id: string;
  name: string;
}

interface OnlineJobSummary {
  id: string;
  status:
    | 'IDLE'
    | 'DISPATCHED'
    | 'READY'
    | 'WAITING_PERMISSION'
    | 'JOINED'
    | 'MONITORING'
    | 'CONCLUDING'
    | 'COMPLETED'
    | 'FAILED';
  statusMessage?: string | null;
  isTimeBound: boolean;
  minStayMinutes: number;
  cycleCount: number;
  attendeeMinutes?: Record<string, number> | null;
  lastHeartbeat?: string | null;
  meetingUrl: string;
  updatedAt: string;
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
  onlineJob?: OnlineJobSummary | null;
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
  const [onlineModalSession, setOnlineModalSession] = useState<Session | null>(null);

  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [classroomId, setClassroomId] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [createError, setCreateError] = useState('');
  const [attendanceViewTab, setAttendanceViewTab] = useState<'present' | 'absent'>('present');

  // Fetch all classrooms for the dropdown
  const { data: classrooms = [] } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: () => apiClient.get('/classrooms').then((r) => r.data),
  });

  // Fetch sessions (auto-poll every 3s when any online bot is active)
  const { data: sessions = [], isLoading } = useQuery<Session[]>({
    queryKey: ['my-sessions'],
    queryFn: () => apiClient.get('/course-rep/sessions').then((r) => r.data),
    refetchInterval: (query) => {
      const list = query.state.data as Session[] | undefined;
      const hasActiveBot = list?.some((s) =>
        ['DISPATCHED', 'READY', 'WAITING_PERMISSION', 'JOINED', 'MONITORING', 'CONCLUDING'].includes(
          s.onlineJob?.status || '',
        ),
      );
      return hasActiveBot ? 3000 : false;
    },
  });

  const concludeBotMutation = useMutation({
    mutationFn: (sessionId: string) =>
      apiClient.post(`/course-rep/sessions/${sessionId}/online-attendance/conclude`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
    },
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
    alert('Session ID copied to clipboard!');
  };

  const copyCheckInLink = (id: string) => {
    const url = `${window.location.origin}/check-in/${id}`;
    navigator.clipboard.writeText(url);
    alert('Web Check-In link copied to clipboard!');
  };

  const attendedStudentIds = new Set(attendance.map((a) => a.student.id));
  const absentStudents = (myClass?.students || []).filter(
    (s) => !attendedStudentIds.has(s.id),
  );

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1F2328]">Class Sessions</h2>
          <p className="text-sm text-[#656D76]">
            Create lecture sessions, broadcast QR codes, and audit live classroom attendance.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setCreateError('');
          }}
          className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Session'}
        </button>
      </div>

      {/* ── Create Session Form ── */}
      {showForm && (
        <div className="bg-white border border-[#D0D7DE] rounded-md p-4 max-w-xl">
          <h3 className="text-sm font-semibold text-[#1F2328] mb-3">
            Schedule a New Session
          </h3>

          {createError && (
            <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#D73A49] px-3 py-2 rounded-md text-xs mb-3">
              {createError}
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-3">
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Session Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Week 4: Operating Systems Lecture"
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Classroom / Location</label>
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
                required
              >
                <option value="">Select a classroom…</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#656D76] mb-1">Start Time</label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[#656D76] mb-1">End Time</label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
                  required
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors disabled:opacity-50"
              >
                {createMutation.isPending ? 'Scheduling…' : 'Schedule Session'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Sessions List ── */}
      {isLoading ? (
        <p className="text-[#656D76]">Loading sessions…</p>
      ) : (
        <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
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
                render: (item) => {
                  const isVirtual = Boolean(
                    item.classroom?.name?.toLowerCase().includes('online') ||
                      item.classroom?.name?.toLowerCase().includes('virtual'),
                  );
                  return (
                    <div className="flex flex-col gap-1 items-start">
                      <span className="text-sm text-[#1F2328]">{item.classroom?.name || '-'}</span>
                      {isVirtual && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0969DA] bg-[#DDF4FF] px-1.5 py-0.5 rounded border border-[#54AEFF]/30">
                          <Globe className="w-2.5 h-2.5" />
                          Virtual / Online
                        </span>
                      )}
                    </div>
                  );
                },
              },
              {
                key: 'startTime',
                header: 'Time Window',
                render: (item) => {
                  const s = new Date(item.startTime);
                  const e = new Date(item.endTime);
                  return (
                    <span className="text-xs text-[#656D76]">
                      {s.toLocaleDateString()} {s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
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
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${
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
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-[#FFEBE9] text-[#CF222E] border border-[#FF8182]/50">
                        Locked
                      </span>
                    );
                  }
                  const now = new Date();
                  const start = new Date(item.startTime);
                  const end = new Date(item.endTime);
                  const isActive = now >= start && now <= end;
                  const isPast = now > end;
                  return (
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        isActive
                          ? 'bg-[#E6F6EC] text-[#1F883D]'
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
                key: 'onlineJob',
                header: 'Bot Status',
                sortable: false,
                render: (item) => {
                  const job = item.onlineJob;
                  if (!job) {
                    return <span className="text-xs text-[#8C959F]">Not launched</span>;
                  }

                  const attendeeCount = job.attendeeMinutes
                    ? Object.keys(job.attendeeMinutes).length
                    : 0;
                  const canConclude = ['WAITING_PERMISSION', 'JOINED', 'MONITORING'].includes(
                    job.status,
                  );

                  const badgeMap: Record<string, string> = {
                    DISPATCHED: 'bg-[#DDF4FF] text-[#0969DA] border-[#54AEFF]/40',
                    READY: 'bg-[#DDF4FF] text-[#0969DA] border-[#54AEFF]/40',
                    WAITING_PERMISSION: 'bg-[#FFF8C5] text-[#9A6700] border-[#D4A72C]/40 animate-pulse',
                    JOINED: 'bg-[#E6F6EC] text-[#1F883D] border-[#2DA44E]/40',
                    MONITORING: 'bg-[#E6F6EC] text-[#1F883D] border-[#2DA44E]/40 animate-pulse',
                    CONCLUDING: 'bg-[#FFF8C5] text-[#9A6700] border-[#D4A72C]/40',
                    COMPLETED: 'bg-[#E6F6EC] text-[#1F883D] border-[#2DA44E]/40',
                    FAILED: 'bg-[#FFEBE9] text-[#CF222E] border-[#FF8182]/40',
                    IDLE: 'bg-[#F6F8FA] text-[#656D76] border-[#D0D7DE]',
                  };

                  return (
                    <div className="space-y-1 max-w-[240px]">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                            badgeMap[job.status] || badgeMap.IDLE
                          }`}
                        >
                          {job.status.replace('_', ' ')}
                        </span>
                        <span className="text-[11px] text-[#656D76]">
                          {job.isTimeBound ? `Time-Bound (${job.cycleCount}c)` : 'One-Off'}
                          {attendeeCount > 0 ? ` · ${attendeeCount} detected` : ''}
                        </span>
                      </div>
                      {job.statusMessage && (
                        <p
                          className="text-[11px] text-[#656D76] line-clamp-2 leading-snug"
                          title={job.statusMessage}
                        >
                          {job.statusMessage}
                        </p>
                      )}
                      {canConclude && (
                        <button
                          onClick={() => concludeBotMutation.mutate(item.id)}
                          disabled={concludeBotMutation.isPending}
                          className="text-[11px] font-semibold text-[#CF222E] hover:underline disabled:opacity-50"
                        >
                          Conclude Now
                        </button>
                      )}
                    </div>
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
                      className="text-[#0969DA] hover:underline text-xs font-medium"
                    >
                      Attendance
                    </button>
                    <span className="text-[#D0D7DE]">|</span>
                    <button
                      onClick={() => setOnlineModalSession(item)}
                      className="text-[#0969DA] hover:text-[#0353A4] text-xs font-semibold flex items-center gap-1 bg-[#DDF4FF] px-2 py-0.5 rounded border border-[#54AEFF]/30 hover:bg-[#B6E3FF] transition-colors"
                      title="Launch Online Attendance Bot (Google Meet / Zoom)"
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Online Bot</span>
                    </button>
                    <span className="text-[#D0D7DE]">|</span>
                    {item.classroom?.name?.toLowerCase().includes('online') ||
                    item.classroom?.name?.toLowerCase().includes('virtual') ? (
                      <span
                        className="text-[#8C959F] text-xs font-normal cursor-not-allowed"
                        title="Physical biometric/QR check-in is disabled for Virtual sessions"
                      >
                        QR Disabled
                      </span>
                    ) : (
                      <button
                        onClick={() => setQrModalSession(item)}
                        className="text-[#0969DA] hover:underline text-xs font-medium"
                      >
                        QR Code
                      </button>
                    )}
                    <span className="text-[#D0D7DE]">|</span>
                    <button
                      onClick={() => copyCheckInLink(item.id)}
                      className="text-[#0969DA] hover:underline text-xs font-medium"
                    >
                      Copy Link
                    </button>
                    <span className="text-[#D0D7DE]">|</span>
                    <button
                      onClick={() => copySessionId(item.id)}
                      className="text-[#0969DA] hover:underline text-xs font-medium"
                    >
                      Copy ID
                    </button>
                    <span className="text-[#D0D7DE]">|</span>
                    <button
                      onClick={() => setEditingSession(item)}
                      className="text-[#0969DA] hover:underline text-xs font-medium"
                    >
                      Edit
                    </button>
                    <span className="text-[#D0D7DE]">|</span>
                    <button
                      onClick={() => {
                        if (confirm(`Delete session "${item.name}"?`)) {
                          singleDeleteMutation.mutate(item.id);
                        }
                      }}
                      className="text-[#D73A49] hover:underline text-xs font-medium"
                    >
                      Delete
                    </button>
                  </div>
                ),
              },
            ]}
            data={sessions}
            keyExtractor={(s) => s.id}
            bulkActionLabel="Delete Selected"
            onBulkAction={(ids) => {
              if (confirm(`Delete ${ids.length} session(s)?`)) {
                bulkDeleteMutation.mutate(ids);
              }
            }}
          />
        </div>
      )}

      {/* ── Attendance Modal with Manual Marking ── */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#D0D7DE] rounded-md shadow-lg p-6 w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-[#1F2328]">
                  Session Attendance Audit
                </h3>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-[#1F883D] font-medium">
                    {attendance.length} Verified Present
                  </span>
                  <span className="text-xs text-[#656D76]">|</span>
                  <span className="text-xs text-[#CF222E] font-medium">
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
                  className="bg-[#1F883D] text-white px-3 py-1.5 rounded-md text-xs font-medium hover:bg-[#1A7F37] transition-colors"
                >
                  Export CSV
                </button>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="text-[#656D76] hover:text-[#1F2328] text-xl leading-none ml-2"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Attendance Tabs: Present vs Absent */}
            <div className="flex border-b border-[#D0D7DE] mb-4 gap-4 text-sm">
              <button
                onClick={() => setAttendanceViewTab('present')}
                className={`pb-2 font-medium border-b-2 transition-colors ${
                  attendanceViewTab === 'present'
                    ? 'border-[#0969DA] text-[#0969DA]'
                    : 'border-transparent text-[#656D76] hover:text-[#1F2328]'
                }`}
              >
                Present Students ({attendance.length})
              </button>
              <button
                onClick={() => setAttendanceViewTab('absent')}
                className={`pb-2 font-medium border-b-2 transition-colors ${
                  attendanceViewTab === 'absent'
                    ? 'border-[#0969DA] text-[#0969DA]'
                    : 'border-transparent text-[#656D76] hover:text-[#1F2328]'
                }`}
              >
                Absent Students ({absentStudents.length})
              </button>
            </div>

            {attendanceViewTab === 'present' ? (
              <DataTable<AttendanceRecord>
                columns={[
                  {
                    key: 'student',
                    header: 'Name',
                    render: (item) => (
                      <span className="font-medium text-[#1F2328]">
                        {item.student.fullName}
                      </span>
                    ),
                  },
                  {
                    key: 'indexNumber',
                    header: 'Index No.',
                    render: (item) => item.student.indexNumber,
                  },
                  {
                    key: 'confidence',
                    header: 'Verification Method',
                    render: (item) => (
                      <span className="inline-block bg-[#E6F6EC] text-[#1F883D] font-mono text-xs px-2 py-0.5 rounded">
                        {item.confidence >= 1.0 ? 'Manual Verification' : `Face: ${(item.confidence * 100).toFixed(1)}%`}
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
                        className="text-[#D73A49] hover:underline text-xs font-medium"
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
                      <span className="font-medium text-[#1F2328]">{item.fullName}</span>
                    ),
                  },
                  { key: 'indexNumber', header: 'Index Number' },
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
                        className="bg-[#1F883D] text-white px-2.5 py-1 rounded text-xs font-medium hover:bg-[#1A7F37] transition-colors disabled:opacity-50"
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

      {/* ── Online Meeting Attendance Bot Modal ── */}
      {onlineModalSession && (
        <OnlineAttendanceModal
          session={{
            id: onlineModalSession.id,
            name: onlineModalSession.name,
          }}
          onClose={() => setOnlineModalSession(null)}
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
  const checkInUrl = `${window.location.origin}/check-in/${session.id}`;
  const mobilePayload = JSON.stringify({
    type: 'trumark_session',
    sessionId: session.id,
    sessionName: session.name,
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-xl shadow-2xl p-6 w-full max-w-md text-center">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#0969DA]" />
            <h3 className="text-base font-semibold text-[#1F2328]">
              Broadcast QR Code
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#656D76] hover:text-[#1F2328] text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Tab selection for Web Check-In vs Mobile App Check-In */}
        <div className="grid grid-cols-2 bg-[#F6F8FA] p-1 rounded-lg border border-[#D0D7DE] mb-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('web')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all ${
              activeTab === 'web'
                ? 'bg-white text-[#0969DA] shadow-sm'
                : 'text-[#656D76] hover:text-[#1F2328]'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web Check-In</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('mobile')}
            className={`flex items-center justify-center gap-1.5 py-1.5 rounded-md transition-all ${
              activeTab === 'mobile'
                ? 'bg-white text-[#0969DA] shadow-sm'
                : 'text-[#656D76] hover:text-[#1F2328]'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Mobile App Check-In</span>
          </button>
        </div>

        {activeTab === 'web' ? (
          <p className="text-xs text-[#656D76] mb-3">
            Students scan with standard camera app to open Web Attendance in browser.
          </p>
        ) : (
          <p className="text-xs text-[#656D76] mb-3">
            Students scan directly inside the TruMark Mobile Application.
          </p>
        )}

        {/* Pure Client-Side Zero-Network SVG Rendering */}
        <div className="inline-block p-4 bg-white border border-[#D0D7DE] rounded-xl shadow-sm mb-4">
          <QRCodeSVG
            value={activeTab === 'web' ? checkInUrl : mobilePayload}
            size={220}
            level="M"
          />
        </div>

        <div className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-lg p-3 mb-4 text-left">
          <div className="text-[11px] text-[#656D76] font-medium uppercase tracking-wider mb-1">
            Session Details
          </div>
          <div className="text-sm font-semibold text-[#1F2328] mb-1">
            {session.name}
          </div>
          <div className="text-xs font-mono text-[#656D76] break-all select-all">
            ID: {session.id}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {activeTab === 'web' ? (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(checkInUrl);
                    alert('Copied Web Check-In Link to clipboard!');
                  }}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#0969DA] text-white py-2 rounded-md text-xs font-semibold hover:bg-[#0353A4] transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Web Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.open(checkInUrl, '_blank')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] rounded-md text-xs font-medium hover:bg-[#EAEEF2]"
                  title="Open Web Check-In in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open</span>
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(session.id);
                alert('Copied Session ID to clipboard!');
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 bg-[#0969DA] text-white py-2 rounded-md text-xs font-semibold hover:bg-[#0353A4] transition-colors"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Copy Mobile Session ID</span>
            </button>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(session.id);
                alert('Copied Session ID to clipboard!');
              }}
              className="flex-1 bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] py-1.5 rounded-md text-xs font-medium hover:bg-[#F3F4F6]"
            >
              Copy Raw ID
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-4 py-1.5 rounded-md text-xs font-medium hover:bg-[#F3F4F6]"
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
      name,
      classroomId,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2328]">
            Edit Session
          </h3>
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
            <label className="block text-xs text-[#656D76] mb-1">Session Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-[#656D76] mb-1">Classroom</label>
            <select
              value={classroomId}
              onChange={(e) => setClassroomId(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
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
              <label className="block text-xs text-[#656D76] mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">End Time</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
                required
              />
            </div>
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
