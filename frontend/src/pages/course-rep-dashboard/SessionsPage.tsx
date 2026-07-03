import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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
  classroom: { name: string } | null;
  createdAt: string;
}

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [classroomId, setClassroomId] = useState('');

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

  const createMutation = useMutation({
    mutationFn: (data: { name: string; startTime: string; endTime: string; classroomId: string }) =>
      apiClient.post('/course-rep/sessions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
      setShowForm(false);
      setName('');
      setStartTime('');
      setEndTime('');
      setClassroomId('');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.delete('/course-rep/sessions/bulk', { data: { sessionIds: ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-sessions'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name, startTime, endTime, classroomId });
  };

  const copyCheckinLink = (sessionId: string) => {
    const url = `${window.location.origin}/public/checkin/${sessionId}`;
    navigator.clipboard.writeText(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[#1F2328]">Sessions</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Session'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-[#D0D7DE] rounded-md p-4 mb-4 space-y-3"
        >
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Session Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Classroom</label>
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
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
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Start Time</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">End Time</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors disabled:opacity-50"
          >
            {createMutation.isPending ? 'Saving…' : 'Create Session'}
          </button>
        </form>
      )}

      {isLoading ? (
        <p className="text-[#656D76] text-sm">Loading sessions…</p>
      ) : (
        <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
          <DataTable<Session>
            columns={[
              { key: 'name', header: 'Name' },
              {
                key: 'classroom',
                header: 'Classroom',
                render: (item) => item.classroom?.name ?? '—',
              },
              {
                key: 'startTime',
                header: 'Start',
                render: (item) => new Date(item.startTime).toLocaleString(),
              },
              {
                key: 'endTime',
                header: 'End',
                render: (item) => new Date(item.endTime).toLocaleString(),
              },
              {
                key: 'id',
                header: '',
                render: (item) => (
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyCheckinLink(item.id)}
                      className="text-[#0969DA] hover:underline text-sm"
                    >
                      Copy Link
                    </button>
                    <button
                      onClick={() => {
                        const url = `${window.location.origin}/api/public/sessions/${item.id}`;
                        // Generate QR via a public QR API
                        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(url)}`;
                        window.open(qrUrl, '_blank');
                      }}
                      className="text-[#0969DA] hover:underline text-sm"
                    >
                      QR Code
                    </button>
                  </div>
                ),
              },
            ]}
            data={sessions}
            keyExtractor={(s) => s.id}
            bulkActionLabel="Delete Selected"
            onBulkAction={(ids) => {
              if (confirm(`Delete ${ids.length} session(s)?`)) bulkDeleteMutation.mutate(ids);
            }}
          />
        </div>
      )}
    </div>
  );
}
