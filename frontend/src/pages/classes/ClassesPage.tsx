import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import apiClient from '../../api/client';
import DataTable from '../../components/DataTable';

interface ClassItem {
  id: string;
  name: string;
  createdAt: string;
}

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');

  const { data: classes = [], isLoading } = useQuery<ClassItem[]>({
    queryKey: ['classes'],
    queryFn: () => apiClient.get('/classes').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { name: string }) => apiClient.post('/classes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      setShowForm(false);
      setName('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/classes/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes'] }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => apiClient.delete('/classes/bulk', { data: { ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[#1F2328]">Classes</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Class'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-[#D0D7DE] rounded-md p-4 mb-4 space-y-3"
        >
          <div>
            <label className="block text-xs text-[#656D76] mb-1">Class Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
              required
            />
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

      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        <DataTable<ClassItem>
          columns={[
            { key: 'name', header: 'Name' },
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
                    if (confirm('Delete this class?')) deleteMutation.mutate(item.id);
                  }}
                  className="text-[#0969DA] hover:underline text-sm"
                >
                  Delete
                </button>
              ),
            },
          ]}
          data={classes}
          keyExtractor={(c) => c.id}
          bulkActionLabel="Delete Selected"
          onBulkAction={(ids) => {
            if (confirm(`Delete ${ids.length} class(es)?`)) bulkDeleteMutation.mutate(ids);
          }}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
