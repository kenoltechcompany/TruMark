import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import {
  Users,
  UserCheck,
  BookOpen,
  Upload,
  UserPlus,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
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
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>('ALL');

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

  const filteredStudents = useMemo(() => {
    if (selectedClassFilter === 'ALL') return students;
    return students.filter((s) => s.class?.id === selectedClassFilter);
  }, [students, selectedClassFilter]);

  const repCount = students.filter((s) => s.isCourseRep || s.courseRep).length;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1F2328]">All Students Directory</h2>
          <p className="text-xs sm:text-sm text-[#656D76] mt-0.5">
            Global roster across all academic classes. Audit student records, import CSV cohorts, or manage profiles.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => setShowImportCsv(true)}
            className="inline-flex items-center gap-1.5 bg-white border border-[#D0D7DE] text-[#1F2328] px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-[#F6F8FA] transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5 text-[#0969DA]" />
            <span>Import CSV</span>
          </button>
          <button
            onClick={() => setShowAddStudent(true)}
            className="inline-flex items-center gap-1.5 bg-[#0969DA] text-white px-3.5 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* ── Tactile Summary Gauges ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Total Enrolled Students
            </span>
            <div className="text-2xl font-bold text-[#1F2328] mt-1 font-mono">
              {students.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA]">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Course Representatives
            </span>
            <div className="text-2xl font-bold text-[#1F883D] mt-1 font-mono">
              {repCount}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#1F883D]">
            <UserCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Active Class Cohorts
            </span>
            <div className="text-2xl font-bold text-[#1F2328] mt-1 font-mono">
              {classes.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA]">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Directory Table ── */}
      <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-xs">
        <DataTable<StudentRecord>
          filterSlot={
            <select
              value={selectedClassFilter}
              onChange={(e) => setSelectedClassFilter(e.target.value)}
              className="bg-white border border-[#D0D7DE] rounded-md px-3 py-1.5 text-xs font-medium text-[#1F2328] focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
            >
              <option value="ALL">All Classes ({students.length})</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          }
          columns={[
            {
              key: 'fullName',
              header: 'Full Name',
              render: (item) => (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#1F2328]">{item.fullName}</span>
                  {(item.isCourseRep || item.courseRep) && (
                    <span className="inline-block bg-[#DDF4FF] text-[#0969DA] border border-[#54AEFF]/60 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                      Course Rep{' '}
                      {item.username
                        ? `(@${item.username})`
                        : item.courseRep
                        ? `(@${item.courseRep.username})`
                        : ''}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'indexNumber',
              header: 'Index Number',
              render: (item) => (
                <span className="font-mono text-xs font-semibold text-[#1F2328] bg-[#F6F8FA] border border-[#D0D7DE] px-2 py-0.5 rounded">
                  {item.indexNumber}
                </span>
              ),
            },
            {
              key: 'class',
              header: 'Class Cohort',
              render: (item) => (
                <span className="text-xs font-medium text-[#1F2328]">
                  {item.class?.name ?? '-'}
                </span>
              ),
            },
            {
              key: 'createdAt',
              header: 'Registered',
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
                    onClick={() => setEditingStudent(item)}
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
                          `Delete student profile for "${item.fullName}" (${item.indexNumber}) and all their attendance records?`,
                        )
                      ) {
                        singleDeleteMutation.mutate(item.id);
                      }
                    }}
                    className="inline-flex items-center gap-1 text-[#CF222E] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Purge</span>
                  </button>
                </div>
              ),
            },
          ]}
          data={filteredStudents}
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
        <p className="text-xs text-[#656D76]">Purging selected student profiles...</p>
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
    updateMutation.mutate({
      fullName: fullName.trim(),
      indexNumber: indexNumber.trim(),
      classId,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-xl shadow-lg p-6 w-full max-w-md animate-enter">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg neu-raised flex items-center justify-center text-[#0969DA]">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-[#1F2328]">
              Edit Student Profile
            </h3>
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

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-[#1F2328] mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1F2328] mb-1">
              Index Number
            </label>
            <input
              type="text"
              value={indexNumber}
              onChange={(e) => setIndexNumber(e.target.value)}
              className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1F2328] mb-1">
              Enrolled Class
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
              required
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-[#E1E4E8]">
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
