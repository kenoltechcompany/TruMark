import React, { useState } from 'react';
import { UserPlus, User, Hash, X } from 'lucide-react';
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
      <div className="bg-white border border-[#D0D7DE] rounded-xl shadow-lg p-4 sm:p-6 w-full max-h-[90dvh] overflow-y-auto max-w-md animate-enter">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg neu-raised flex items-center justify-center text-[#0969DA]">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#1F2328]">Add Student Profile</h3>
              <p className="text-xs text-[#656D76]">Enroll student into class roster</p>
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
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-[#656D76] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. Ama Mensah"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="border border-[#D0D7DE] rounded-lg pl-9 pr-3.5 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#1F2328] mb-1">
              Index Number
            </label>
            <div className="relative">
              <Hash className="w-4 h-4 text-[#656D76] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="e.g. 10293847"
                value={indexNumber}
                onChange={(e) => setIndexNumber(e.target.value)}
                className="border border-[#D0D7DE] rounded-lg pl-9 pr-3.5 py-2 text-sm w-full font-mono focus:outline-none focus:ring-2 focus:ring-[#0969DA]"
                required
              />
            </div>
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
              disabled={isSubmitting}
              className="bg-[#0969DA] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#0353A4] transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Creating...' : 'Create Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
