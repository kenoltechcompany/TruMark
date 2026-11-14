import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  MapPin,
  Crosshair,
  ShieldCheck,
  Plus,
  X,
  ExternalLink,
  Pencil,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import apiClient from '../../api/client';
import DataTable from '../../components/DataTable';

interface Classroom {
  id: string;
  name: string;
  gpsLatitude: number;
  gpsLongitude: number;
  radiusMeters: number;
  createdAt: string;
}

export default function ClassroomsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(null);

  const [name, setName] = useState('');
  const [gpsLatitude, setGpsLatitude] = useState('');
  const [gpsLongitude, setGpsLongitude] = useState('');
  const [radiusMeters, setRadiusMeters] = useState('100');
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [gpsNotice, setGpsNotice] = useState('');

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
      setRadiusMeters('100');
      setGpsNotice('');
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
      name: name.trim(),
      gpsLatitude: parseFloat(gpsLatitude),
      gpsLongitude: parseFloat(gpsLongitude),
      radiusMeters: parseInt(radiusMeters, 10),
    });
  };

  const captureCurrentLocation = () => {
    if (!navigator.geolocation) {
      setGpsNotice('Geolocation is not supported by your browser.');
      return;
    }
    setIsCapturingGps(true);
    setGpsNotice('');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLatitude(pos.coords.latitude.toFixed(6));
        setGpsLongitude(pos.coords.longitude.toFixed(6));
        setGpsNotice(`Captured live coordinates (\u00b1${Math.round(pos.coords.accuracy)}m accuracy)`);
        setIsCapturingGps(false);
      },
      (err) => {
        setGpsNotice('Could not get GPS position: ' + err.message);
        setIsCapturingGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const avgRadius =
    classrooms.length > 0
      ? Math.round(classrooms.reduce((sum, c) => sum + c.radiusMeters, 0) / classrooms.length)
      : 0;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-[#1F2328]">Classrooms &amp; Geofences</h2>
          <p className="text-xs sm:text-sm text-[#656D76] mt-0.5">
            Define physical lecture halls with GPS coordinates and Haversine radius boundaries.
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingClassroom(null);
            setGpsNotice('');
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
              <span>New Classroom</span>
            </>
          )}
        </button>
      </div>

      {/* ── Tactile Summary Gauges ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Registered Classrooms
            </span>
            <div className="text-2xl font-bold text-[#1F2328] mt-1 font-mono">
              {classrooms.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA]">
            <MapPin className="w-5 h-5" />
          </div>
        </div>

        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Avg Geofence Radius
            </span>
            <div className="text-2xl font-bold text-[#1F2328] mt-1 font-mono">
              {avgRadius}m
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#0969DA]">
            <Crosshair className="w-5 h-5" />
          </div>
        </div>

        <div className="neu-raised p-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#656D76]">
              Boundary Drift Tolerance
            </span>
            <div className="text-2xl font-bold text-[#1F883D] mt-1 font-mono">
              +5m Grace
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white border border-[#D0D7DE] flex items-center justify-center text-[#1F883D]">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ── Create Classroom Drawer ── */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="bg-white border border-[#D0D7DE] rounded-xl p-5 space-y-4 shadow-xs animate-enter"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#E1E4E8] pb-3">
            <div>
              <h3 className="text-sm font-bold text-[#1F2328]">Register Lecture Hall / Lab</h3>
              <p className="text-xs text-[#656D76]">
                Stand inside the lecture hall and click Capture Current GPS, or enter coordinates manually.
              </p>
            </div>
            <button
              type="button"
              onClick={captureCurrentLocation}
              disabled={isCapturingGps}
              className="inline-flex items-center gap-1.5 bg-[#F6F8FA] border border-[#D0D7DE] text-[#0969DA] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white hover:border-[#0969DA] transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Crosshair className={`w-3.5 h-3.5 ${isCapturingGps ? 'animate-spin' : ''}`} />
              <span>{isCapturingGps ? 'Acquiring GPS...' : 'Capture Current GPS'}</span>
            </button>
          </div>

          {gpsNotice && (
            <div className="bg-[#E6F6EC] border border-[#34D058] text-[#1F883D] px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{gpsNotice}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
                Classroom Name / Room Number
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Science Lecture Hall A"
                className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
                Geofence Radius (meters)
              </label>
              <input
                type="number"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(e.target.value)}
                placeholder="e.g. 100"
                className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                required
                min="1"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
                GPS Latitude
              </label>
              <input
                type="number"
                step="any"
                value={gpsLatitude}
                onChange={(e) => setGpsLatitude(e.target.value)}
                placeholder="e.g. 5.6508"
                className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F2328] mb-1.5">
                GPS Longitude
              </label>
              <input
                type="number"
                step="any"
                value={gpsLongitude}
                onChange={(e) => setGpsLongitude(e.target.value)}
                placeholder="e.g. -0.1869"
                className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                required
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-[#0969DA] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {createMutation.isPending ? 'Saving...' : 'Save Classroom'}
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

      {/* ── Classrooms Table ── */}
      <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-xs">
        <DataTable<Classroom>
          columns={[
            {
              key: 'name',
              header: 'Lecture Hall / Room',
              render: (item) => (
                <span className="font-semibold text-[#1F2328]">{item.name}</span>
              ),
            },
            {
              key: 'coordinates',
              header: 'GPS Coordinates',
              render: (item) => (
                <div className="flex items-center gap-2.5">
                  <span className="font-mono text-xs bg-[#F6F8FA] border border-[#D0D7DE] px-2 py-0.5 rounded text-[#1F2328]">
                    {item.gpsLatitude.toFixed(6)}, {item.gpsLongitude.toFixed(6)}
                  </span>
                  <a
                    href={`https://www.google.com/maps?q=${item.gpsLatitude},${item.gpsLongitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#0969DA] hover:underline text-xs font-medium"
                  >
                    <span>Map</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              ),
            },
            {
              key: 'radiusMeters',
              header: 'Geofence Radius',
              render: (item) => (
                <span className="text-xs font-mono font-semibold text-[#1F883D] bg-[#E6F6EC] border border-[#34D058]/50 px-2.5 py-0.5 rounded-md">
                  {item.radiusMeters}m (+5m grace)
                </span>
              ),
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
                    onClick={() => setEditingClassroom(item)}
                    className="inline-flex items-center gap-1 text-[#0969DA] hover:underline text-xs font-semibold cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                  <span className="text-[#D0D7DE]">|</span>
                  <button
                    onClick={() => {
                      if (confirm(`Delete classroom "${item.name}"?`)) {
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
  const [gpsUpdated, setGpsUpdated] = useState(false);

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
      name: name.trim(),
      gpsLatitude: parseFloat(gpsLatitude),
      gpsLongitude: parseFloat(gpsLongitude),
      radiusMeters: parseInt(radiusMeters, 10),
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-xl shadow-lg p-6 w-full max-w-lg animate-enter">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg neu-raised flex items-center justify-center text-[#0969DA]">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1F2328]">
                Edit Classroom Geofence
              </h3>
              <p className="text-xs text-[#656D76]">{classroom.name}</p>
            </div>
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
              Classroom Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1F2328] mb-1">
              Geofence Radius (meters)
            </label>
            <input
              type="number"
              value={radiusMeters}
              onChange={(e) => setRadiusMeters(e.target.value)}
              className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
              required
              min="1"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                GPS Latitude
              </label>
              <input
                type="number"
                step="any"
                value={gpsLatitude}
                onChange={(e) => setGpsLatitude(e.target.value)}
                className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#1F2328] mb-1">
                GPS Longitude
              </label>
              <input
                type="number"
                step="any"
                value={gpsLongitude}
                onChange={(e) => setGpsLongitude(e.target.value)}
                className="border border-[#D0D7DE] rounded-lg px-3.5 py-2 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => {
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setGpsLatitude(pos.coords.latitude.toFixed(6));
                    setGpsLongitude(pos.coords.longitude.toFixed(6));
                    setGpsUpdated(true);
                  },
                  (err) => setError('Could not get GPS position: ' + err.message),
                  { enableHighAccuracy: true, timeout: 10000 },
                );
              }}
              className="inline-flex items-center gap-1.5 bg-[#F6F8FA] border border-[#D0D7DE] text-[#0969DA] px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-white hover:border-[#0969DA] transition-colors cursor-pointer"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Update With Current GPS</span>
            </button>
            {gpsUpdated && (
              <span className="text-[11px] font-medium text-[#1F883D]">
                Coordinates updated!
              </span>
            )}
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
