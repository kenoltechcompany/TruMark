import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import apiClient from '../../api/client';
import DataTable from '../../components/DataTable';

interface ClassItem {
  id: string;
  name: string;
  createdAt: string;
  _count?: {
    students: number;
    sessions: number;
    courseReps: number;
  };
  courseReps?: { id: string; username: string }[];
}

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null);
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
    mutationFn: (ids: string[]) =>
      apiClient.delete('/classes/bulk', { data: { ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({ name });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1F2328]">Classes</h2>
          <p className="text-sm text-[#656D76] mt-0.5">
            Manage academic classes, sections, and view their assigned representatives and student rosters.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingClass(null);
          }}
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
              placeholder="e.g. Computer Science Level 400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full max-w-sm focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
              required
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving…' : 'Save Class'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        <DataTable<ClassItem>
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (item) => <span className="font-medium text-[#1F2328]">{item.name}</span>,
            },
            {
              key: 'students',
              header: 'Enrolled Students',
              render: (item) => (
                <span className="text-sm text-[#24292F]">
                  {item._count?.students ?? 0} students
                </span>
              ),
            },
            {
              key: 'sessions',
              header: 'Sessions',
              render: (item) => (
                <span className="text-sm text-[#24292F]">
                  {item._count?.sessions ?? 0} sessions
                </span>
              ),
            },
            {
              key: 'reps',
              header: 'Course Rep(s)',
              render: (item) => {
                const reps = item.courseReps || [];
                if (!reps.length) return <span className="text-xs text-[#656D76]">None</span>;
                return (
                  <div className="flex flex-wrap gap-1">
                    {reps.map((r) => (
                      <span
                        key={r.id}
                        className="bg-[#E1F0FF] text-[#0969DA] text-xs font-medium px-2 py-0.5 rounded"
                      >
                        @{r.username}
                      </span>
                    ))}
                  </div>
                );
              },
            },
            {
              key: 'createdAt',
              header: 'Created',
              render: (item) => new Date(item.createdAt).toLocaleDateString(),
            },
            {
              key: 'actions',
              header: 'Actions',
              sortable: false,
              render: (item) => (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingClass(item)}
                    className="text-[#0969DA] hover:underline text-sm font-medium"
                  >
                    Edit
                  </button>
                  <span className="text-[#D0D7DE]">|</span>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Delete class "${item.name}"? This will delete all associated sessions and unlink students.`,
                        )
                      ) {
                        deleteMutation.mutate(item.id);
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
          data={classes}
          keyExtractor={(c) => c.id}
          bulkActionLabel="Delete Selected"
          onBulkAction={(ids) => {
            if (confirm(`Delete ${ids.length} class(es)?`)) bulkDeleteMutation.mutate(ids);
          }}
          loading={isLoading}
        />
      </div>

      {/* ── Edit Modal ── */}
      {editingClass && (
        <EditClassModal
          cls={editingClass}
          onClose={() => setEditingClass(null)}
          onSuccess={() => {
            setEditingClass(null);
            queryClient.invalidateQueries({ queryKey: ['classes'] });
          }}
        />
      )}
    </div>
  );
}

function EditClassModal({
  cls,
  onClose,
  onSuccess,
}: {
  cls: ClassItem;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(cls.name);
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: { name: string }) => apiClient.patch(`/classes/${cls.id}`, data),
    onSuccess: () => onSuccess(),
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to update class');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ name });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2328]">Edit Class Name</h3>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-[#656D76] mb-1">Class Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
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
