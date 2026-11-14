import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { BookOpen, Users, Calendar, Plus, X, Pencil, Trash2 } from 'lucide-react';
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
    createMutation.mutate({ name: name.trim() });
  };

  const totalStudents = classes.reduce((acc, c) => acc + (c._count?.students ?? 0), 0);
  const totalSessions = classes.reduce((acc, c) => acc + (c._count?.sessions ?? 0), 0);

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1F2328]">Classes</h2>
          <p className="text-xs sm:text-sm text-[#656D76] mt-0.5">
            Manage academic classes, sections, and view their assigned representatives and student rosters.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingClass(null);
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
              <span>New Class</span>
            </>
          )}
        </button>
      </div>

      {/* ── Tactile Summary Gauges ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Total Classes
            </span>
            <div className="text-2xl font-bold text-[#1F2328] mt-1 font-mono">
              {classes.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA]">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Enrolled Students
            </span>
            <div className="text-2xl font-bold text-[#1F883D] mt-1 font-mono">
              {totalStudents}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#1F883D]">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Total Sessions
            </span>
            <div className="text-2xl font-bold text-[#1F2328] mt-1 font-mono">
              {totalSessions}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA]">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── New Class Drawer ── */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-[#D0D7DE] rounded-xl p-5 space-y-4 shadow-xs animate-enter"
        >
          <div className="flex items-center justify-between border-b border-[#E1E4E8] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#1F2328]">Create Academic Class</h3>
              <p className="text-xs text-[#656D76]">
                Students and Course Representatives will be linked to this class cohort.
              </p>
            </div>
          </div>

          <div className="max-w-md">
            <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
              Class Name / Programme Level
            </label>
            <input
              type="text"
              placeholder="e.g. BSc Computer Science - Level 400"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-[#0969DA]"
              required
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-[#0969DA] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Class'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#1F2328] px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#EAEEF2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Classes Table ── */}
      <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-xs">
        <DataTable<ClassItem>
          columns={[
            {
              key: 'name',
              header: 'Class Name',
              render: (item) => (
                <span className="font-semibold text-[#1F2328]">{item.name}</span>
              ),
            },
            {
              key: 'students',
              header: 'Enrolled Students',
              render: (item) => (
                <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold text-[#1F2328] bg-[#F6F8FA] border border-[#D0D7DE] px-2.5 py-0.5 rounded-md">
                  {item._count?.students ?? 0} students
                </span>
              ),
            },
            {
              key: 'sessions',
              header: 'Sessions',
              render: (item) => (
                <span className="text-xs font-mono text-[#656D76]">
                  {item._count?.sessions ?? 0} sessions
                </span>
              ),
            },
            {
              key: 'reps',
              header: 'Course Rep(s)',
              render: (item) => {
                const reps = item.courseReps || [];
                if (!reps.length) {
                  return <span className="text-xs text-[#656D76]">Unassigned</span>;
                }
                return (
                  <div className="flex flex-wrap gap-1.5">
                    {reps.map((r) => (
                      <span
                        key={r.id}
                        className="bg-[#DDF4FF] text-[#0969DA] border border-[#54AEFF]/50 text-xs font-mono font-semibold px-2 py-0.5 rounded-md"
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
              render: (item) => (
                <span className="text-xs text-[#656D76]">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              ),
            },
            {
              key: 'actions',
              header: 'Actions',
              sortable: false,
              render: (item) => (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingClass(item)}
                    className="inline-flex items-center gap-1 text-[#0969DA] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
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
                    className="inline-flex items-center gap-1 text-[#CF222E] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Delete</span>
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
    updateMutation.mutate({ name: name.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-xl shadow-lg p-6 w-full max-w-md animate-enter">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg neu-raised flex items-center justify-center text-[#0969DA]">
              <BookOpen className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#1F2328]">Edit Class Name</h3>
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
              Class Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
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
