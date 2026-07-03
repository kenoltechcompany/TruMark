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
  createdAt: string;
}

export default function ClassroomsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
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
    mutationFn: (ids: string[]) => apiClient.delete('/classrooms/bulk', { data: { ids } }),
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
        <h2 className="text-lg font-semibold text-[#1F2328]">Classrooms</h2>
        <button
          onClick={() => setShowForm(!showForm)}
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Classroom Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#656D76] mb-1">Radius (meters)</label>
              <input
                type="number"
                value={radiusMeters}
                onChange={(e) => setRadiusMeters(e.target.value)}
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
                className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:border-transparent shadow-sm"
                required
              />
            </div>
          </div>
          {/* GPS Capture - uses browser geolocation API */}
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
            className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors"
          >
            Capture Current GPS
          </button>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-white border border-[#D0D7DE] rounded-md p-4">
        <DataTable<Classroom>
          columns={[
            { key: 'name', header: 'Name' },
            {
              key: 'gpsLatitude',
              header: 'Latitude',
              render: (item) => item.gpsLatitude.toFixed(6),
            },
            {
              key: 'gpsLongitude',
              header: 'Longitude',
              render: (item) => item.gpsLongitude.toFixed(6),
            },
            {
              key: 'radiusMeters',
              header: 'Radius (m)',
              render: (item) => `${item.radiusMeters}m`,
            },
            {
              key: 'createdAt',
              header: 'Created',
              render: (item) => new Date(item.createdAt).toLocaleDateString(),
            },
            {
              key: 'id',
              header: '',
              render: (item) => (
                <button
                  onClick={() => {
                    if (confirm('Delete this classroom?')) deleteMutation.mutate(item.id);
                  }}
                  className="text-[#0969DA] hover:underline text-sm"
                >
                  Delete
                </button>
              ),
            },
          ]}
          data={classrooms}
          keyExtractor={(c) => c.id}
          bulkActionLabel="Delete Selected"
          onBulkAction={(ids) => {
            if (confirm(`Delete ${ids.length} classroom(s)?`)) bulkDeleteMutation.mutate(ids);
          }}
          loading={isLoading}
        />
      </div>
    </div>
  );
}
