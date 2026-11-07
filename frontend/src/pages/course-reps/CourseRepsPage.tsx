import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import apiClient from '../../api/client';
import DataTable from '../../components/DataTable';

interface ClassItem {
  id: string;
  name: string;
}

interface StudentItem {
  id: string;
  fullName: string;
  indexNumber: string;
  isCourseRep: boolean;
  class: { id: string; name: string };
}

interface CourseRep {
  id: string;
  fullName: string;
  indexNumber: string;
  username: string;
  email: string;
  isCourseRep: boolean;
  class: { id: string; name: string } | null;
  createdAt: string;
}

export default function CourseRepsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [createMode, setCreateMode] = useState<'promote' | 'new'>('promote');
  const [editingRep, setEditingRep] = useState<CourseRep | null>(null);

  // Form states for creation
  const [fullName, setFullName] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [error, setError] = useState('');

  // Fetch all course reps
  const { data: reps = [], isLoading } = useQuery<CourseRep[]>({
    queryKey: ['course-reps'],
    queryFn: () => apiClient.get('/course-reps').then((r) => r.data),
  });

  // Fetch all classes for dropdown
  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ['classes'],
    queryFn: () => apiClient.get('/classes').then((r) => r.data),
  });

  // Fetch all students for promoting
  const { data: allStudents = [] } = useQuery<StudentItem[]>({
    queryKey: ['admin-students'],
    queryFn: () => apiClient.get('/admins/students/all').then((r) => r.data),
  });

  // Filter students who are not yet course reps
  const eligibleStudents = (
    selectedClassId
      ? allStudents.filter((s) => s.class?.id === selectedClassId)
      : allStudents
  ).filter((s) => !s.isCourseRep);

  const createNewMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/course-reps', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-reps'] });
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      resetForm();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to create course representative.');
    },
  });

  const promoteMutation = useMutation({
    mutationFn: (data: any) => apiClient.post('/course-reps/promote-student', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-reps'] });
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
      resetForm();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to promote student.');
    },
  });

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; payload: any }) =>
      apiClient.patch(`/course-reps/${data.id}`, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-reps'] });
      setEditingRep(null);
      resetForm();
    },
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to update course representative.');
    },
  });

  const demoteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/course-reps/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['course-reps'] });
      queryClient.invalidateQueries({ queryKey: ['admin-students'] });
    },
  });

  const resetForm = () => {
    setShowForm(false);
    setFullName('');
    setIndexNumber('');
    setUsername('');
    setEmail('');
    setPassword('');
    setSelectedClassId('');
    setSelectedStudentId('');
    setError('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (createMode === 'promote') {
      if (!selectedStudentId || !username.trim() || !email.trim() || !password) {
        setError('Please select a student and fill in all login credentials.');
        return;
      }
      promoteMutation.mutate({
        studentId: selectedStudentId,
        username: username.trim(),
        email: email.trim(),
        password,
      });
    } else {
      if (!fullName.trim() || !indexNumber.trim() || !selectedClassId || !username.trim() || !email.trim() || !password) {
        setError('All student profile and login credential fields are required.');
        return;
      }
      createNewMutation.mutate({
        fullName: fullName.trim(),
        indexNumber: indexNumber.trim(),
        classId: selectedClassId,
        username: username.trim(),
        email: email.trim(),
        password,
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1F2328]">Course Representatives</h2>
          <p className="text-sm text-[#656D76]">
            Assign student leaders to manage attendance sessions and onboarding links for their class.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowForm(!showForm);
          }}
          className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
        >
          {showForm ? 'Cancel' : '+ Add Course Rep'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-[#D0D7DE] rounded-md p-4 max-w-xl">
          <div className="flex border-b border-[#D0D7DE] mb-4 gap-4 text-sm">
            <button
              onClick={() => { setCreateMode('promote'); setError(''); }}
              className={`pb-2 font-medium border-b-2 transition-colors ${
                createMode === 'promote' ? 'border-[#0969DA] text-[#0969DA]' : 'border-transparent text-[#656D76]'
              }`}
            >
              Promote Enrolled Student
            </button>
            <button
              onClick={() => { setCreateMode('new'); setError(''); }}
              className={`pb-2 font-medium border-b-2 transition-colors ${
                createMode === 'new' ? 'border-[#0969DA] text-[#0969DA]' : 'border-transparent text-[#656D76]'
              }`}
            >
              Create New Rep Profile
            </button>
          </div>

          {error && (
            <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#D73A49] px-3 py-2 rounded-md text-xs mb-3">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {createMode === 'promote' ? (
              <>
                <div>
                  <label className="block text-xs text-[#656D76] mb-1">Filter by Class (Optional)</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => {
                      setSelectedClassId(e.target.value);
                      setSelectedStudentId('');
                    }}
                    className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  >
                    <option value="">All Classes</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-[#656D76] mb-1">Select Student to Promote</label>
                  <select
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                    required
                  >
                    <option value="">Choose an enrolled student…</option>
                    {eligibleStudents.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.fullName} ({s.indexNumber}) - {s.class?.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-[#656D76] mb-1">Full Name</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#656D76] mb-1">Index Number</label>
                    <input
                      type="text"
                      value={indexNumber}
                      onChange={(e) => setIndexNumber(e.target.value)}
                      placeholder="e.g. 10294820"
                      className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-[#656D76] mb-1">Assigned Class</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                    required
                  >
                    <option value="">Select a class…</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs text-[#656D76] mb-1">Login Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. jdoe_rep"
                  className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-[#656D76] mb-1">Notification Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jdoe@school.edu"
                  className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#656D76] mb-1">Initial Password (min 6 chars)</label>
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
                onClick={resetForm}
                className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createNewMutation.isPending || promoteMutation.isPending}
                className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] disabled:opacity-50"
              >
                Save Course Rep
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Course Rep Table */}
      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        {isLoading ? (
          <p className="text-[#656D76]">Loading course representatives…</p>
        ) : (
          <DataTable<CourseRep>
            columns={[
              {
                key: 'fullName',
                header: 'Student Name',
                render: (item) => (
                  <div>
                    <span className="font-semibold text-[#1F2328]">{item.fullName}</span>
                    <span className="text-xs text-[#656D76] ml-2 font-mono">({item.indexNumber})</span>
                  </div>
                ),
              },
              {
                key: 'username',
                header: 'Username',
                render: (item) => <span className="font-medium text-[#0969DA]">@{item.username}</span>,
              },
              { key: 'email', header: 'Email' },
              {
                key: 'class',
                header: 'Managed Class',
                render: (item) => item.class?.name || '-',
              },
              {
                key: 'actions',
                header: 'Actions',
                sortable: false,
                render: (item) => (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setEditingRep(item);
                        setFullName(item.fullName);
                        setUsername(item.username);
                        setEmail(item.email);
                        setPassword('');
                        setSelectedClassId(item.class?.id || '');
                        setError('');
                      }}
                      className="text-[#0969DA] hover:underline text-xs font-medium"
                    >
                      Edit
                    </button>
                    <span className="text-[#D0D7DE]">|</span>
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Demote "${item.fullName}" from Course Representative? They will remain an enrolled student in their class with all attendance records intact.`,
                          )
                        ) {
                          demoteMutation.mutate(item.id);
                        }
                      }}
                      className="text-[#CF222E] hover:underline text-xs font-medium"
                    >
                      Demote
                    </button>
                  </div>
                ),
              },
            ]}
            data={reps}
            emptyMessage="No course representatives assigned yet."
          />
        )}
      </div>

      {/* Edit Modal */}
      {editingRep && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-[#D0D7DE] rounded-md shadow-lg p-6 w-full max-w-md">
            <h3 className="text-base font-semibold text-[#1F2328] mb-3">Edit Course Representative</h3>
            {error && (
              <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#D73A49] px-3 py-2 rounded-md text-xs mb-3">
                {error}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateMutation.mutate({
                  id: editingRep.id,
                  payload: {
                    fullName: fullName.trim() || undefined,
                    username: username.trim() || undefined,
                    email: email.trim() || undefined,
                    password: password.trim() || undefined,
                    classId: selectedClassId || undefined,
                  },
                });
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs text-[#656D76] mb-1">Student Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-xs text-[#656D76] mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-[#656D76] mb-1">Assigned Class</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
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
                  onClick={() => setEditingRep(null)}
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
