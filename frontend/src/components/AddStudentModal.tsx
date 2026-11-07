import React, { useState } from 'react';
import apiClient from '../api/client';

interface AddStudentModalProps {
  classes: Array<{ id: string; name: string }>;
  defaultClassId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddStudentModal({
  classes,
  defaultClassId,
  onClose,
  onSuccess,
}: AddStudentModalProps) {
  const [fullName, setFullName] = useState('');
  const [indexNumber, setIndexNumber] = useState('');
  const [classId, setClassId] = useState(defaultClassId || (classes[0]?.id ?? ''));
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await apiClient.post('/admins/students', {
        fullName: fullName.trim(),
        indexNumber: indexNumber.trim(),
        classId,
      });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to create student profile');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-[#D0D7DE] rounded-md shadow-lg p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-[#1F2328]">Add Student Profile</h3>
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
            <label className="block text-xs font-medium text-[#656D76] mb-1">Full Name</label>
            <input
              type="text"
              placeholder="e.g. Ama Mensah"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#656D76] mb-1">Index Number</label>
            <input
              type="text"
              placeholder="e.g. 10293847"
              value={indexNumber}
              onChange={(e) => setIndexNumber(e.target.value)}
              className="border border-[#D0D7DE] rounded-md px-3 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA] shadow-sm"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#656D76] mb-1">Enrolled Class</label>
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
              disabled={isSubmitting}
              className="bg-[#0969DA] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#0353A4] transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Creating…' : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
