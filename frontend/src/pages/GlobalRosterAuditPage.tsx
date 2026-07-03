import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../api/client';
import DataTable from '../components/DataTable';

interface StudentRecord {
  id: string;
  fullName: string;
  indexNumber: string;
  createdAt: string;
  class: { id: string; name: string };
}

export default function GlobalRosterAuditPage() {
  const queryClient = useQueryClient();

  const { data: students = [], isLoading } = useQuery<StudentRecord[]>({
    queryKey: ['admin-students'],
    queryFn: () => apiClient.get('/admins/students/all').then((r) => r.data),
  });

  const purgeMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.delete('/admins/students/purge', { data: { studentIds: ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-students'] }),
  });

  return (
    <div>
      <h2 className="text-lg font-semibold text-[#1F2328] mb-4">Global Roster Audit</h2>
      <p className="text-sm text-[#656D76] mb-4">
        Master list of all students across all classes. Search, select, and purge student profiles.
      </p>

      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        <DataTable<StudentRecord>
          columns={[
            { key: 'fullName', header: 'Full Name' },
            { key: 'indexNumber', header: 'Index Number' },
            {
              key: 'class',
              header: 'Class',
              render: (item) => item.class?.name ?? '—',
            },
            {
              key: 'createdAt',
              header: 'Registered',
              render: (item) => new Date(item.createdAt).toLocaleDateString(),
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
    </div>
  );
}
