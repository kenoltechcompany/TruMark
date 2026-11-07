import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import apiClient from '../api/client';
import DataTable from '../components/DataTable';
import CsvImportModal from '../components/CsvImportModal';
import AddStudentModal from '../components/AddStudentModal';

interface ClassItem {
  id: string;
  name: string;
}

interface StudentRecord {
  id: string;
  fullName: string;
  indexNumber: string;
  isCourseRep?: boolean;
  username?: string | null;
  createdAt: string;
  class: { id: string; name: string };
  courseRep?: { id: string; username: string } | null;
}

export default function GlobalRosterAuditPage() {
  const queryClient = useQueryClient();
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [showImportCsv, setShowImportCsv] = useState(false);

  const { data: students = [], isLoading } = useQuery<StudentRecord[]>({
    queryKey: ['admin-students'],
    queryFn: () => apiClient.get('/admins/students/all').then((r) => r.data),
  });

  const { data: classes = [] } = useQuery<ClassItem[]>({
    queryKey: ['classes'],
    queryFn: () => apiClient.get('/classes').then((r) => r.data),
  });

  const purgeMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.delete('/admins/students/purge', { data: { studentIds: ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-students'] }),
  });

  const singleDeleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/admins/students/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-students'] }),
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1F2328] mb-1">All Students</h2>
          <p className="text-sm text-[#656D76]">
            Directory of all enrolled students across all classes. View biometric enrollment, edit records, or manage profiles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImportCsv(true)}
            className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
          >
            Import CSV
          </button>
          <button
            onClick={() => setShowAddStudent(true)}
            className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
          >
            + Add Student
          </button>
        </div>
      </div>

      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        <DataTable<StudentRecord>
          columns={[
            {
              key: 'fullName',
              header: 'Full Name',
              render: (item) => (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-[#1F2328]">{item.fullName}</span>
                  {(item.isCourseRep || item.courseRep) && (
                    <span className="inline-block bg-[#DDF4FF] text-[#0969DA] border border-[#54AEFF] text-[11px] font-semibold px-2 py-0.5 rounded">
                      Course Rep {item.username ? `(@${item.username})` : item.courseRep ? `(@${item.courseRep.username})` : ''}
                    </span>
                  )}
                </div>
              ),
            },
            { key: 'indexNumber', header: 'Index Number' },
            {
              key: 'class',
              header: 'Class',
              render: (item) => item.class?.name ?? '-',
            },
            {
              key: 'createdAt',
              header: 'Registered',
              render: (item) => new Date(item.createdAt).toLocaleDateString(),
            },
            {
              key: 'actions',
              header: 'Actions',
              sortable: false,
              render: (item) => (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingStudent(item)}
                    className="text-[#0969DA] hover:underline text-sm font-medium"
                  >
                    Edit
                  </button>
                  <span className="text-[#D0D7DE]">|</span>
                  <button
                    onClick={() => {
                      if (
                        confirm(
                          `Delete student profile for "${item.fullName}" (${item.indexNumber}) and all their attendance records?`,
                        )
                      ) {
                        singleDeleteMutation.mutate(item.id);
                      }
                    }}
                    className="text-[#D73A49] hover:underline text-sm font-medium"
                  >
                    Purge
                  </button>
                </div>
              ),
            },
          ]}
          data={students}
          keyExtractor={(s) => s.id}
          bulkActionLabel="Bulk Purge Student Profiles"
          onBulkAction={(ids) => {
            if (
              confirm(
                `WARNING: This will permanently delete ${ids.length} student profile(s) and all their attendance records. Continue?`,
              )
            ) {
              purgeMutation.mutate(ids);
            }
          }}
          loading={isLoading}
        />
      </div>

      {purgeMutation.isPending && (
        <p className="text-sm text-[#656D76] mt-2">Purging selected students…</p>
      )}

      {/* ── Add Student Modal ── */}
      {showAddStudent && (
        <AddStudentModal
          classes={classes}
          onClose={() => setShowAddStudent(false)}
          onSuccess={() => {
            setShowAddStudent(false);
            queryClient.invalidateQueries({ queryKey: ['admin-students'] });
          }}
        />
      )}

      {/* ── Import CSV Modal ── */}
      {showImportCsv && (
        <CsvImportModal
          classes={classes}
          apiEndpoint="/admins/students/import-csv"
          onClose={() => setShowImportCsv(false)}
          onSuccess={() => {
            setShowImportCsv(false);
            queryClient.invalidateQueries({ queryKey: ['admin-students'] });
          }}
        />
      )}

      {/* ── Edit Student Modal ── */}
      {editingStudent && (
        <EditStudentModal
          student={editingStudent}
          classes={classes}
          onClose={() => setEditingStudent(null)}
          onSuccess={() => {
            setEditingStudent(null);
            queryClient.invalidateQueries({ queryKey: ['admin-students'] });
          }}
        />
      )}
    </div>
  );
}

function EditStudentModal({
  student,
  classes,
  onClose,
  onSuccess,
}: {
  student: StudentRecord;
  classes: ClassItem[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [fullName, setFullName] = useState(student.fullName);
  const [indexNumber, setIndexNumber] = useState(student.indexNumber);
  const [classId, setClassId] = useState(student.class?.id || '');
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      apiClient.patch(`/admins/students/${student.id}`, data),
    onSuccess: () => onSuccess(),
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to update student profile');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ fullName, indexNumber, classId });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2328]">
            Edit Student Profile
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
            <label className="block text-xs text-[#656D76] mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-[#656D76] mb-1">Index Number</label>
            <input
              type="text"
              value={indexNumber}
              onChange={(e) => setIndexNumber(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-[#656D76] mb-1">Enrolled Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
              required
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
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
