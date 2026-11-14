import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Shield, Lock, KeyRound, Plus, Pencil, Trash2, X } from 'lucide-react';
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
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1F2328]">System Administrators</h2>
          <p className="text-xs sm:text-sm text-[#656D76] mt-0.5">
            Manage root administrators with full access to classes, lecture hall geofences, and global roster audits.
          </p>
        </div>
        <button
          onClick={() => {
            setUsername('');
            setPassword('');
            setFormError('');
            setShowCreateModal(true);
          }}
          className="inline-flex items-center gap-1.5 bg-[#0969DA] text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Administrator</span>
        </button>
      </div>

      {/* ── Tactile Summary Gauges ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Root Administrators
            </span>
            <div className="text-2xl font-bold text-[#1F2328] mt-1 font-mono">
              {admins.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA]">
            <Shield className="w-5 h-5" />
          </div>
        </div>

        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Privilege Scope
            </span>
            <div className="text-lg font-bold text-[#1F883D] mt-1">
              Full Institutional
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#1F883D]">
            <KeyRound className="w-5 h-5" />
          </div>
        </div>

        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Credential Hashing
            </span>
            <div className="text-lg font-bold text-[#1F2328] mt-1 font-mono">
              Bcrypt + JWT
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA]">
            <Lock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Administrators Table ── */}
      <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-xs">
        <DataTable<AdminUser>
          columns={[
            {
              key: 'username',
              header: 'Administrator Handle',
              render: (item) => (
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold text-[#1F2328]">
                    @{item.username}
                  </span>
                  <span className="bg-[#E6F6EC] text-[#1F883D] border border-[#34D058]/50 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                    Root Admin
                  </span>
                </div>
              ),
            },
            {
              key: 'createdAt',
              header: 'Provisioned On',
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
                    onClick={() => {
                      setEditingAdmin(item);
                      setUsername(item.username);
                      setPassword('');
                      setFormError('');
                    }}
                    className="inline-flex items-center gap-1 text-[#0969DA] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
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
                        className="inline-flex items-center gap-1 text-[#CF222E] hover:underline text-xs font-semibold cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Delete</span>
                      </button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
          data={admins}
          loading={isLoading}
          emptyMessage="No administrator accounts found."
        />
      </div>

      {/* ── Create Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#D0D7DE] rounded-xl shadow-lg p-6 w-full max-w-md animate-enter">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg neu-raised flex items-center justify-center text-[#0969DA]">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#1F2328]">Add Administrator</h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-[#656D76] hover:text-[#1F2328] p-1 rounded-md hover:bg-[#F6F8FA] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#CF222E] px-3 py-2 rounded-lg text-xs mb-3">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. registrar_admin"
                  className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                  Password (min 6 characters)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                  minLength={6}
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E4E8]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#1F2328] px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#EAEEF2] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="bg-[#0969DA] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] disabled:opacity-50 cursor-pointer"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editingAdmin && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#D0D7DE] rounded-xl shadow-lg p-6 w-full max-w-md animate-enter">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg neu-raised flex items-center justify-center text-[#0969DA]">
                  <Shield className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-[#1F2328]">Edit Administrator</h3>
              </div>
              <button
                onClick={() => setEditingAdmin(null)}
                className="text-[#656D76] hover:text-[#1F2328] p-1 rounded-md hover:bg-[#F6F8FA] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#CF222E] px-3 py-2 rounded-lg text-xs mb-3">
                {formError}
              </div>
            )}

            <form onSubmit={handleUpdateSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                  New Password (leave blank to keep current)
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E4E8]">
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#1F2328] px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#EAEEF2] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="bg-[#0969DA] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] disabled:opacity-50 cursor-pointer"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
