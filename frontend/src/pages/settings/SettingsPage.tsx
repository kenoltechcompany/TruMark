import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Settings, Globe, ScanFace, MapPin, Check, AlertCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import apiClient from '../../api/client';

interface SystemSettings {
  enableLandingPage: boolean;
  enableBiometricValidation: boolean;
  enableGeofencing: boolean;
  updatedAt?: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState('');

  const { data: settings, isLoading, isError } = useQuery<SystemSettings>({
    queryKey: ['admin-settings'],
    queryFn: () => apiClient.get('/admins/settings').then((r) => r.data),
  });

  const mutation = useMutation({
    mutationFn: (updated: Partial<SystemSettings>) =>
      apiClient.patch('/admins/settings', updated).then((r) => r.data),
    onSuccess: (data) => {
      queryClient.setQueryData(['admin-settings'], data);
      queryClient.invalidateQueries({ queryKey: ['public-settings'] });
      setSuccessMessage('System settings updated successfully.');
      setTimeout(() => setSuccessMessage(''), 4000);
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || 'Failed to update system settings.');
    },
  });

  const handleToggleLandingPage = () => {
    if (!settings) return;
    mutation.mutate({ enableLandingPage: !settings.enableLandingPage });
  };

  const handleToggleBiometric = () => {
    if (!settings) return;
    mutation.mutate({ enableBiometricValidation: !settings.enableBiometricValidation });
  };

  const handleToggleGeofencing = () => {
    if (!settings) return;
    mutation.mutate({ enableGeofencing: !settings.enableGeofencing });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-[#656D76]">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-[#0969DA]" />
        <span>Loading system settings...</span>
      </div>
    );
  }

  if (isError || !settings) {
    return (
      <div className="bg-[#FFEBE9] border border-[#FF8182] text-[#D73A49] p-4 rounded-lg flex items-center gap-2">
        <AlertCircle className="w-5 h-5" />
        <span>Failed to load system settings. Please verify administrator permissions.</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Settings className="w-5 h-5 text-[#0969DA]" />
          <h2 className="text-lg font-semibold text-[#1F2328]">System Settings</h2>
        </div>
        <p className="text-sm text-[#656D76]">
          Configure institutional access controls, landing page availability, and attendance verification policies.
        </p>
      </div>

      {successMessage && (
        <div className="bg-[#E6F6EC] border border-[#34D058] text-[#1F883D] px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 animate-in fade-in duration-200">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Settings Cards Grid */}
      <div className="space-y-4">
        {/* Toggle 1: Enable Landing Page */}
        <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-xs transition-all hover:border-[#0969DA]/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#DDF4FF] text-[#0969DA] flex items-center justify-center shrink-0 mt-0.5">
                <Globe className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-[#1F2328]">
                    Public Landing Page
                  </h3>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      settings.enableLandingPage
                        ? 'bg-[#E6F6EC] text-[#1F883D]'
                        : 'bg-[#F6F8FA] text-[#656D76] border border-[#D0D7DE]'
                    }`}
                  >
                    {settings.enableLandingPage ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#656D76] leading-relaxed max-w-xl">
                  When enabled, visiting the root address (<code className="bg-[#F6F8FA] px-1 py-0.5 rounded text-xs border border-[#D0D7DE]">/</code>)
                  displays the TruMark overview and quick check-in page. When disabled, visitors are immediately redirected to the portal login.
                </p>
              </div>
            </div>

            <div className="sm:self-center">
              <button
                type="button"
                role="switch"
                aria-checked={settings.enableLandingPage}
                disabled={mutation.isPending}
                onClick={handleToggleLandingPage}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:ring-offset-2 ${
                  settings.enableLandingPage ? 'bg-[#1F883D]' : 'bg-[#D0D7DE]'
                } ${mutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.enableLandingPage ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Toggle 2: Enable Biometric Face Verification */}
        <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-xs transition-all hover:border-[#0969DA]/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#E6F6EC] text-[#1F883D] flex items-center justify-center shrink-0 mt-0.5">
                <ScanFace className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-[#1F2328]">
                    Biometric Face Verification
                  </h3>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      settings.enableBiometricValidation
                        ? 'bg-[#E6F6EC] text-[#1F883D]'
                        : 'bg-[#FFF8E5] text-[#9A6700] border border-[#D0D7DE]'
                    }`}
                  >
                    {settings.enableBiometricValidation ? 'Strict Biometrics' : 'Bypassed (Index Only)'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#656D76] leading-relaxed max-w-xl">
                  When enabled, students must match their reference facial biometrics using the webcam.
                  When disabled, <strong>face matching is bypassed</strong> and students verify attendance directly using their student index number.
                </p>
              </div>
            </div>

            <div className="sm:self-center">
              <button
                type="button"
                role="switch"
                aria-checked={settings.enableBiometricValidation}
                disabled={mutation.isPending}
                onClick={handleToggleBiometric}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:ring-offset-2 ${
                  settings.enableBiometricValidation ? 'bg-[#1F883D]' : 'bg-[#D0D7DE]'
                } ${mutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.enableBiometricValidation ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {!settings.enableBiometricValidation && (
            <div className="mt-4 pt-3 border-t border-[#D0D7DE] flex items-center gap-2 text-xs text-[#9A6700]">
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#9A6700]" />
              <span>
                Simplified attendance mode active: Students will mark attendance via student index numbers without facial recognition.
              </span>
            </div>
          )}
        </div>

        {/* Toggle 3: Enable Classroom GPS Geofencing */}
        <div className="bg-white border border-[#D0D7DE] rounded-xl p-5 shadow-xs transition-all hover:border-[#0969DA]/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-lg bg-[#FBEFFF] text-[#8250DF] flex items-center justify-center shrink-0 mt-0.5">
                <MapPin className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-[#1F2328]">
                    Classroom GPS Geofencing
                  </h3>
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                      settings.enableGeofencing
                        ? 'bg-[#E6F6EC] text-[#1F883D]'
                        : 'bg-[#FFF8E5] text-[#9A6700] border border-[#D0D7DE]'
                    }`}
                  >
                    {settings.enableGeofencing ? 'Strict Geofence' : 'Bypassed (Any Location)'}
                  </span>
                </div>
                <p className="text-xs sm:text-sm text-[#656D76] leading-relaxed max-w-xl">
                  When enabled, students must be physically within the classroom perimeter (plus 5m tolerance) to mark attendance.
                  When disabled, <strong>GPS coordinate verification is bypassed completely</strong>, permitting remote attendance.
                </p>
              </div>
            </div>

            <div className="sm:self-center">
              <button
                type="button"
                role="switch"
                aria-checked={settings.enableGeofencing}
                disabled={mutation.isPending}
                onClick={handleToggleGeofencing}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#0969DA] focus:ring-offset-2 ${
                  settings.enableGeofencing ? 'bg-[#1F883D]' : 'bg-[#D0D7DE]'
                } ${mutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.enableGeofencing ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {!settings.enableGeofencing && (
            <div className="mt-4 pt-3 border-t border-[#D0D7DE] flex items-center gap-2 text-xs text-[#9A6700]">
              <ShieldCheck className="w-4 h-4 shrink-0 text-[#9A6700]" />
              <span>
                Remote attendance mode active: Students will not be checked against classroom GPS perimeter boundaries.
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
