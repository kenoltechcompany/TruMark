import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import apiClient from '../../api/client';
import DataTable from '../../components/DataTable';

interface AdminUser {
  id: string;
  username: string;
  createdAt: string;
}

export default function AdminsPage() {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');

  const { data: admins = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ['admins'],
    queryFn: () => apiClient.get('/admins').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      apiClient.post('/admins', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setShowCreateModal(false);
      setUsername('');
      setPassword('');
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to create administrator account.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; username?: string; password?: string }) =>
      apiClient.patch(`/admins/${data.id}`, {
        username: data.username,
        ...(data.password ? { password: data.password } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      setEditingAdmin(null);
      setUsername('');
      setPassword('');
      setFormError('');
    },
    onError: (err: any) => {
      setFormError(err.response?.data?.message || 'Failed to update administrator.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admins/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admins'] }),
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to delete administrator.');
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!username.trim() || !password.trim()) {
      setFormError('Both username and password are required.');
      return;
    }
    createMutation.mutate({ username: username.trim(), password });
  };

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setFormError('');
    updateMutation.mutate({
      id: editingAdmin.id,
      username: username.trim() || undefined,
      password: password.trim() || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1F2328]">System Administrators</h2>
          <p className="text-sm text-[#656D76]">
            Manage root administrators with full access to classes, rooms, and roster audits.
          </p>
        </div>
        <button
          onClick={() => {
            setUsername('');
            setPassword('');
            setFormError('');
            setShowCreateModal(true);
          }}
          className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
        >
          Add Administrator
        </button>
      </div>

      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        {isLoading ? (
          <p className="text-[#656D76]">Loading administrators…</p>
        ) : (
          <DataTable<AdminUser>
            columns={[
              {
                key: 'username',
                header: 'Username',
                render: (item) => (
                  <span className="font-medium text-[#1F2328]">@{item.username}</span>
                ),
              },
              {
                key: 'createdAt',
                header: 'Created On',
                render: (item) => new Date(item.createdAt).toLocaleDateString(),
              },
              {
                key: 'actions',
                header: 'Actions',
                sortable: false,
                render: (item) => (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingAdmin(item);
                        setUsername(item.username);
                        setPassword('');
                        setFormError('');
                      }}
                      className="text-[#0969DA] hover:underline text-sm font-medium"
                    >
                      Edit
                    </button>
                    {admins.length > 1 && (
                      <>
                        <span className="text-[#D0D7DE]">|</span>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Are you sure you want to delete administrator "@${item.username}"?`,
                              )
                            ) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                          className="text-[#CF222E] hover:underline text-sm font-medium"
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
            data={admins}
            emptyMessage="No administrator accounts found."
          />
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#D0D7DE] rounded-md shadow-lg p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-[#1F2328] mb-3">Add Administrator</h3>
            {formError && (
              <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#D73A49] px-3 py-2 rounded-md text-xs mb-3">
                {formError}
              </div>
            )}
            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-[#656D76] mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[#656D76] mb-1">Password (min 6 characters)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#D0D7DE] rounded-md shadow-lg p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-[#1F2328] mb-3">Edit Administrator</h3>
            {formError && (
              <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#D73A49] px-3 py-2 rounded-md text-xs mb-3">
                {formError}
              </div>
            )}
            <form onSubmit={handleUpdateSubmit} className="space-y-3">
              <div>
                <label className="block text-xs text-[#656D76] mb-1">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[#656D76] mb-1">New Password (leave blank to keep current)</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
