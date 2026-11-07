import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Bot,
  Video,
  Play,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Users,
  ShieldCheck,
  StopCircle,
  ExternalLink,
} from 'lucide-react';
import apiClient from '../api/client';

interface OnlineAttendanceModalProps {
  session: {
    id: string;
    name: string;
    className?: string;
  };
  onClose: () => void;
}

interface OnlineAttendee {
  indexNumber: string;
  fullName: string;
  minutes: number;
}

interface OnlineJobStatus {
  id: string;
  sessionId: string;
  sessionName: string;
  meetingUrl: string;
  platform: string;
  isTimeBound: boolean;
  minStayMinutes: number;
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
  statusMessage: string;
  cycleCount: number;
  lastHeartbeat: string;
  attendees: OnlineAttendee[];
}

export default function OnlineAttendanceModal({
  session,
  onClose,
}: OnlineAttendanceModalProps) {
  const queryClient = useQueryClient();

  const [meetingUrl, setMeetingUrl] = useState('');
  const [isTimeBound, setIsTimeBound] = useState(false);
  const [minStayMinutes, setMinStayMinutes] = useState(30);
  const [editMinStay, setEditMinStay] = useState(30);
  const [formError, setFormError] = useState('');

  // Poll active online attendance status every 3 seconds
  const { data: job, isLoading } = useQuery<OnlineJobStatus | null>({
    queryKey: ['online-attendance-job', session.id],
    queryFn: () =>
      apiClient
        .get(`/course-rep/sessions/${session.id}/online-attendance`)
        .then((r) => r.data)
        .catch(() => null),
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (job) {
      if (job.meetingUrl && !meetingUrl) setMeetingUrl(job.meetingUrl);
      setIsTimeBound(job.isTimeBound);
      setMinStayMinutes(job.minStayMinutes);
      setEditMinStay(job.minStayMinutes);
    }
  }, [job]);

  // Launch Bot Mutation
  const launchMutation = useMutation({
    mutationFn: (data: {
      meetingUrl: string;
      isTimeBound: boolean;
      minStayMinutes: number;
    }) =>
      apiClient.post(
        `/course-rep/sessions/${session.id}/online-attendance`,
        data,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['online-attendance-job', session.id],
      });
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(
        err.response?.data?.message || 'Failed to dispatch meeting bot.',
      );
    },
  });

  // Update Config Mutation
  const updateConfigMutation = useMutation({
    mutationFn: (newMinStay: number) =>
      apiClient.patch(
        `/course-rep/sessions/${session.id}/online-attendance/config`,
        {
          minStayMinutes: newMinStay,
        },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['online-attendance-job', session.id],
      });
      alert('Minimum stay threshold updated on active worker.');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update configuration.');
    },
  });

  // Conclude Mutation
  const concludeMutation = useMutation({
    mutationFn: () =>
      apiClient.post(
        `/course-rep/sessions/${session.id}/online-attendance/conclude`,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['online-attendance-job', session.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['attendance', session.id],
      });
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to conclude meeting.');
    },
  });

  const handleLaunch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!meetingUrl.trim()) {
      setFormError('Please enter a valid meeting link.');
      return;
    }
    launchMutation.mutate({
      meetingUrl: meetingUrl.trim(),
      isTimeBound,
      minStayMinutes: isTimeBound ? Number(minStayMinutes) : 0,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DISPATCHED':
      case 'READY':
        return (
          <span className="bg-[#FFF8E5] text-[#9A6700] border border-[#D0D7DE] text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Connecting Bot...</span>
          </span>
        );
      case 'WAITING_PERMISSION':
        return (
          <span className="bg-[#FFF8E5] text-[#9A6700] border border-[#D0D7DE] text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 animate-pulse">
            <Clock className="w-3 h-3" />
            <span>Waiting for Host to Admit</span>
          </span>
        );
      case 'JOINED':
      case 'MONITORING':
        return (
          <span className="bg-[#E6FFED] text-[#1F883D] border border-[#34D058] text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#1F883D] animate-ping" />
            <span>In Meeting &bull; Monitoring</span>
          </span>
        );
      case 'CONCLUDING':
        return (
          <span className="bg-[#DDF4FF] text-[#0969DA] border border-[#54AEFF] text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Finalizing Attendance...</span>
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="bg-[#E6FFED] text-[#1F883D] border border-[#34D058] text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <CheckCircle className="w-3 h-3" />
            <span>Attendance Completed</span>
          </span>
        );
      case 'FAILED':
        return (
          <span className="bg-[#FFEBE9] text-[#CF222E] border border-[#FF8182] text-[11px] font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" />
            <span>Failed / Timed Out</span>
          </span>
        );
      default:
        return null;
    }
  };

  const isJobActive =
    job &&
    job.status !== 'COMPLETED' &&
    job.status !== 'FAILED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-xl border border-[#D0D7DE] shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="px-6 py-4 border-b border-[#D0D7DE] flex items-center justify-between bg-[#F6F8FA]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#DDF4FF] text-[#0969DA] flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-[#1F2328]">
                Online Attendance Bot: {session.name}
              </h3>
              <span className="text-[11px] text-[#656D76]">
                Automated Google Meet Roster Scraping &amp; Time Tracking
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[#656D76] hover:bg-[#E1E4E8] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Modal Body ── */}
        <div className="p-6 overflow-y-auto space-y-5">
          {formError && (
            <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#CF222E] p-3 rounded-lg text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* If No Active Job or Failed, Show Launch Form */}
          {(!job || job.status === 'FAILED') && (
            <form onSubmit={handleLaunch} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                  Meeting Link (Google Meet / Zoom)
                </label>
                <div className="relative">
                  <Video className="w-4 h-4 text-[#656D76] absolute left-3 top-2.5" />
                  <input
                    type="url"
                    placeholder="https://meet.google.com/abc-defg-hij"
                    value={meetingUrl}
                    onChange={(e) => setMeetingUrl(e.target.value)}
                    className="w-full border border-[#D0D7DE] rounded-md pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                    required
                  />
                </div>
                <p className="text-[11px] text-[#656D76] mt-1">
                  Paste the full invite link. The TruMark bot will join as a guest attendee.
                </p>
              </div>

              {/* Mode Selection */}
              <div className="border border-[#D0D7DE] rounded-xl p-4 bg-[#F6F8FA] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-[#1F2328]">
                      Time-Bound Attendance Tracking
                    </h4>
                    <p className="text-[11px] text-[#656D76]">
                      When enabled, the bot remains in the call throughout the session and samples every 5 minutes.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isTimeBound}
                    onClick={() => setIsTimeBound(!isTimeBound)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0969DA] ${
                      isTimeBound ? 'bg-[#0969DA]' : 'bg-[#D0D7DE]'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition duration-200 ease-in-out ${
                        isTimeBound ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {isTimeBound ? (
                  <div className="pt-3 border-t border-[#D0D7DE] flex items-center gap-3">
                    <label className="text-xs font-medium text-[#1F2328] whitespace-nowrap">
                      Minimum Stay Required:
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="5"
                        max="240"
                        step="5"
                        value={minStayMinutes}
                        onChange={(e) =>
                          setMinStayMinutes(parseInt(e.target.value) || 5)
                        }
                        className="w-20 border border-[#D0D7DE] rounded-md px-2.5 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                      />
                      <span className="text-xs text-[#656D76]">minutes</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-[#1F883D] font-medium pt-1">
                    ⚡ Instant Snapshot Active: Bot joins once, scans all visible attendees, marks attendance, and leaves immediately.
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={launchMutation.isPending}
                className="w-full bg-[#1F883D] text-white py-2.5 px-4 rounded-lg text-xs font-bold hover:bg-[#1A7F37] transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {launchMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Dispatching Bot...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    <span>Join Meeting with Attendance Bot</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Active / Running Job Status View */}
          {job && job.status !== 'FAILED' && (
            <div className="space-y-4">
              {/* Status Banner */}
              <div className="bg-[#F6F8FA] border border-[#D0D7DE] rounded-xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 pb-2 border-b border-[#E1E4E8]">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#1F2328]">
                      Live Bot Status:
                    </span>
                    {getStatusBadge(job.status)}
                  </div>
                  {job.isTimeBound && (
                    <span className="text-xs text-[#656D76] font-medium">
                      Cycle {job.cycleCount} ({job.cycleCount * 5} mins sampled)
                    </span>
                  )}
                </div>

                <p className="text-xs text-[#1F2328] font-medium leading-relaxed">
                  {job.statusMessage}
                </p>

                {job.status === 'WAITING_PERMISSION' && (
                  <div className="mt-2.5 bg-[#FFF8E5] border border-[#D0D7DE] text-[#9A6700] p-2.5 rounded-lg text-[11px]">
                    <strong>Action Required:</strong> The meeting host or lecturer must click <em>"Admit"</em> on the Google Meet screen to allow the TruMark bot into the call.
                  </div>
                )}
              </div>

              {/* Dynamic Min Time Adjustment & Conclude Controls */}
              {isJobActive && job.isTimeBound && (
                <div className="bg-white border border-[#D0D7DE] rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <label className="text-xs font-medium text-[#1F2328] whitespace-nowrap">
                      Min Time:
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="240"
                      step="5"
                      value={editMinStay}
                      onChange={(e) => setEditMinStay(parseInt(e.target.value) || 5)}
                      className="w-16 border border-[#D0D7DE] rounded-md px-2 py-1 text-xs text-center focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                    />
                    <span className="text-xs text-[#656D76]">min</span>
                    <button
                      type="button"
                      onClick={() => updateConfigMutation.mutate(Number(editMinStay))}
                      disabled={updateConfigMutation.isPending}
                      className="bg-[#0969DA] text-white text-[11px] font-semibold px-2.5 py-1 rounded-md hover:bg-[#0353A4] transition-colors disabled:opacity-50"
                    >
                      Update
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Conclude attendance now? The bot will leave the call and finalize records.')) {
                        concludeMutation.mutate();
                      }
                    }}
                    disabled={concludeMutation.isPending}
                    className="w-full sm:w-auto bg-[#CF222E] text-white text-xs font-bold px-3 py-1.5 rounded-md hover:bg-[#A40E26] transition-colors flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                  >
                    <StopCircle className="w-4 h-4" />
                    <span>Conclude Attendance &amp; Leave</span>
                  </button>
                </div>
              )}

              {/* Attendees List Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#0969DA]" />
                    <h4 className="text-xs font-bold text-[#1F2328]">
                      Identified Participants ({job.attendees.length})
                    </h4>
                  </div>
                  {job.isTimeBound && (
                    <span className="text-[11px] text-[#656D76]">
                      Threshold: &ge; {job.minStayMinutes} mins
                    </span>
                  )}
                </div>

                {job.attendees.length === 0 ? (
                  <div className="border border-dashed border-[#D0D7DE] rounded-lg p-6 text-center text-xs text-[#656D76]">
                    No participants with valid index numbers detected yet.
                  </div>
                ) : (
                  <div className="border border-[#D0D7DE] rounded-lg overflow-hidden max-h-52 overflow-y-auto text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-[#F6F8FA] border-b border-[#D0D7DE] text-[11px] text-[#656D76]">
                        <tr>
                          <th className="py-2 px-3">Student Name</th>
                          <th className="py-2 px-3">Index Number</th>
                          {job.isTimeBound && <th className="py-2 px-3">Minutes Stayed</th>}
                          <th className="py-2 px-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#D0D7DE]">
                        {job.attendees.map((a) => {
                          const isQualified =
                            !job.isTimeBound || a.minutes >= job.minStayMinutes;

                          return (
                            <tr key={a.indexNumber} className="hover:bg-[#F6F8FA]">
                              <td className="py-2 px-3 font-medium text-[#1F2328]">
                                {a.fullName}
                              </td>
                              <td className="py-2 px-3 text-[#656D76] font-mono">
                                {a.indexNumber}
                              </td>
                              {job.isTimeBound && (
                                <td className="py-2 px-3 font-semibold text-[#0969DA]">
                                  {a.minutes} min
                                </td>
                              )}
                              <td className="py-2 px-3 text-right">
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                    isQualified
                                      ? 'bg-[#E6FFED] text-[#1F883D]'
                                      : 'bg-[#FFF8E5] text-[#9A6700]'
                                  }`}
                                >
                                  {isQualified ? 'Qualified' : 'In Progress'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="px-6 py-3 border-t border-[#D0D7DE] bg-[#F6F8FA] flex items-center justify-between text-xs text-[#656D76]">
          <span>TruMark Autonomous Online Attendance</span>
          <button
            onClick={onClose}
            className="bg-white border border-[#D0D7DE] px-3.5 py-1.5 rounded-md font-semibold text-[#1F2328] hover:bg-[#F6F8FA] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
