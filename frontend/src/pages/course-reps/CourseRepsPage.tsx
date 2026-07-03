import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import apiClient from '../../api/client';
import DataTable from '../../components/DataTable';

interface CourseRep {
  id: string;
  username: string;
  email: string;
  createdAt: string;
}

export default function CourseRepsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { data: reps = [], isLoading } = useQuery<CourseRep[]>({
    queryKey: ['course-reps'],
    queryFn: () => apiClient.get('/course-reps').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { username: string; email: string; password: string }) =>
      apiClient.post('/course-reps', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-reps'] });
      setShowForm(false);
      setUsername('');
      setEmail('');
      setPassword('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/course-reps/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course-reps'] }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => apiClient.delete('/course-reps/bulk', { data: { ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['course-reps'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ username, email, password });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#1F2328]">Course Representatives</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Course Rep'}
        </button>
      </div>

      {/* ── Create form ── */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-[#D0D7DE] rounded-md p-4 mb-4 space-y-3"
        >
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            {createMutation.isPending ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {/* ── Table ── */}
      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        <DataTable<CourseRep>
          columns={[
            { key: 'username', header: 'Username' },
            { key: 'email', header: 'Email' },
            {
              key: 'createdAt',
              header: 'Created',
              render: (item) => new Date(item.createdAt).toLocaleDateString(),
            },
            {
              key: 'id',
              header: '',
              render: (item) => (
                <button
                  onClick={() => {
                    if (confirm('Delete this course rep?')) deleteMutation.mutate(item.id);
                  }}
                  className="text-[#0969DA] hover:underline text-sm"
                >
                  Delete
                </button>
              ),
            },
          ]}
          data={reps}
          keyExtractor={(r) => r.id}
          bulkActionLabel="Delete Selected"
          onBulkAction={(ids) => {
            if (confirm(`Delete ${ids.length} course rep(s)?`)) bulkDeleteMutation.mutate(ids);
          }}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
