import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import apiClient from '../../api/client';
import DataTable from '../../components/DataTable';

interface Classroom {
  id: string;
  name: string;
  gpsLatitude: number;
  gpsLongitude: number;
  radiusMeters: number;
  isVirtual?: boolean;
  createdAt: string;
}

export default function ClassroomsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);

  const [name, setName] = useState('');
  const [gpsLatitude, setGpsLatitude] = useState('');
  const [gpsLongitude, setGpsLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('');

  const { data: classrooms = [], isLoading } = useQuery<Classroom[]>({
    queryKey: ['classrooms'],
    queryFn: () => apiClient.get('/classrooms').then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      gpsLatitude: number;
      gpsLongitude: number;
      radiusMeters: number;
    }) => apiClient.post('/classrooms', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classrooms'] });
      setShowForm(false);
      setName('');
      setGpsLatitude('');
      setGpsLongitude('');
      setRadiusMeters('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/classrooms/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classrooms'] }),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiClient.delete('/classrooms/bulk', { data: { ids } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classrooms'] }),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name,
      gpsLatitude: parseFloat(gpsLatitude),
      gpsLongitude: parseFloat(gpsLongitude),
      radiusMeters: parseInt(radiusMeters, 10),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-[#1F2328]">Classrooms</h2>
          <p className="text-sm text-[#656D76] mt-0.5">
            Define classroom physical locations with GPS coordinates and radius for geofence validation.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingClassroom(null);
          }}
          className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Classroom'}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-[#D0D7DE] rounded-md p-4 mb-4 space-y-3"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#656D76] mb-1">
                Classroom Name / Room Number
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Science Lab 101"
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">
                Geofence Radius (meters)
              </label>
              <input
                type="number"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(e.target.value)}
                placeholder="e.g. 50"
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">GPS Latitude</label>
              <input
                type="number"
                step="any"
                value={gpsLatitude}
                onChange={(e) => setGpsLatitude(e.target.value)}
                placeholder="e.g. 5.6037"
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">GPS Longitude</label>
              <input
                type="number"
                step="any"
                value={gpsLongitude}
                onChange={(e) => setGpsLongitude(e.target.value)}
                placeholder="e.g. -0.1870"
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setGpsLatitude(pos.coords.latitude.toString());
                    setGpsLongitude(pos.coords.longitude.toString());
                  },
                  (err) => {
                    alert('Could not get GPS position: ' + err.message);
                  },
                  { enableHighAccuracy: true, timeout: 10000 },
                );
              }}
              className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#F3F4F6] transition-colors"
            >
              📍 Capture Current GPS
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving…' : 'Save Classroom'}
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
        <DataTable<Classroom>
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (item) => {
                const isVirt = Boolean(
                  item.isVirtual ||
                    item.name.toLowerCase().includes('online') ||
                    item.name.toLowerCase().includes('virtual'),
                );
                return (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1F2328]">{item.name}</span>
                    {isVirt && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0969DA] bg-[#DDF4FF] px-1.5 py-0.5 rounded border border-[#54AEFF]/30">
                        Default Virtual
                      </span>
                    )}
                  </div>
                );
              },
            },
            {
              key: 'coordinates',
              header: 'Coordinates',
              render: (item) => {
                const isVirt = Boolean(
                  item.isVirtual ||
                    item.name.toLowerCase().includes('online') ||
                    item.name.toLowerCase().includes('virtual'),
                );
                if (isVirt) {
                  return (
                    <span className="text-xs text-[#656D76] italic">
                      Virtual Classroom (No GPS geofence)
                    </span>
                  );
                }
                return (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {item.gpsLatitude.toFixed(6)}, {item.gpsLongitude.toFixed(6)}
                    </span>
                    <a
                      href={`https://www.google.com/maps?q=${item.gpsLatitude},${item.gpsLongitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#0969DA] hover:underline text-xs"
                    >
                      View Map
                    </a>
                  </div>
                );
              },
            },
            {
              key: 'radiusMeters',
              header: 'Geofence Radius',
              render: (item) => {
                const isVirt = Boolean(
                  item.isVirtual ||
                    item.name.toLowerCase().includes('online') ||
                    item.name.toLowerCase().includes('virtual'),
                );
                return isVirt ? 'Online Only' : `${item.radiusMeters}m (tolerance: +5m)`;
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
              render: (item) => {
                const isVirt = Boolean(
                  item.isVirtual ||
                    item.name.toLowerCase().includes('online') ||
                    item.name.toLowerCase().includes('virtual'),
                );
                return (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingClassroom(item)}
                      className="text-[#0969DA] hover:underline text-sm font-medium"
                    >
                      Edit
                    </button>
                    <span className="text-[#D0D7DE]">|</span>
                    {isVirt ? (
                      <span
                        className="text-[#8C959F] text-xs cursor-not-allowed"
                        title="System default virtual classroom cannot be deleted"
                      >
                        Protected
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          if (confirm(`Delete classroom "${item.name}"?`)) {
                            deleteMutation.mutate(item.id);
                          }
                        }}
                        className="text-[#D73A49] hover:underline text-sm font-medium"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
          data={classrooms}
          keyExtractor={(c) => c.id}
          bulkActionLabel="Delete Selected"
          onBulkAction={(ids) => {
            if (confirm(`Delete ${ids.length} classroom(s)?`)) {
              bulkDeleteMutation.mutate(ids);
            }
          }}
          loading={isLoading}
        />
      </div>

      {/* ── Edit Modal ── */}
      {editingClassroom && (
        <EditClassroomModal
          classroom={editingClassroom}
          onClose={() => setEditingClassroom(null)}
          onSuccess={() => {
            setEditingClassroom(null);
            queryClient.invalidateQueries({ queryKey: ['classrooms'] });
          }}
        />
      )}
    </div>
  );
}

function EditClassroomModal({
  classroom,
  onClose,
  onSuccess,
}: {
  classroom: Classroom;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(classroom.name);
  const [gpsLatitude, setGpsLatitude] = useState(classroom.gpsLatitude.toString());
  const [gpsLongitude, setGpsLongitude] = useState(classroom.gpsLongitude.toString());
  const [radiusMeters, setRadiusMeters] = useState(classroom.radiusMeters.toString());
  const [error, setError] = useState('');

  const updateMutation = useMutation({
    mutationFn: (data: any) =>
      apiClient.patch(`/classrooms/${classroom.id}`, data),
    onSuccess: () => onSuccess(),
    onError: (err: any) => {
      setError(err?.response?.data?.message || 'Failed to update classroom');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      name,
      gpsLatitude: parseFloat(gpsLatitude),
      gpsLongitude: parseFloat(gpsLongitude),
      radiusMeters: parseInt(radiusMeters, 10),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-lg p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2328]">
            Edit Classroom: {classroom.name}
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
            <label className="block text-xs text-[#656D76] mb-1">Classroom Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs text-[#656D76] mb-1">
              Geofence Radius (meters)
            </label>
            <input
              type="number"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
              required
              min="1"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#656D76] mb-1">GPS Latitude</label>
              <input
                type="number"
                step="any"
                value={gpsLatitude}
                onChange={(e) => setGpsLatitude(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">GPS Longitude</label>
              <input
                type="number"
                step="any"
                value={gpsLongitude}
                onChange={(e) => setGpsLongitude(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
                required
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setGpsLatitude(pos.coords.latitude.toString());
                  setGpsLongitude(pos.coords.longitude.toString());
                },
                (err) => alert('Could not get GPS position: ' + err.message),
                { enableHighAccuracy: true, timeout: 10000 },
              );
            }}
            className="bg-[#F6F8FA] border border-[#D0D7DE] text-[#24292F] px-3 py-1 rounded text-xs font-medium hover:bg-[#F3F4F6] transition-colors"
          >
            📍 Update With Current GPS
          </button>

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
