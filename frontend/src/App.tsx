import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import apiClient from './api/client';
import DashboardLayout from './components/DashboardLayout';
import CourseRepDashboardLayout from './components/CourseRepDashboardLayout';
import LoginPage from './pages/LoginPage';
import CourseRepsPage from './pages/course-reps/CourseRepsPage';
import ClassesPage from './pages/classes/ClassesPage';
import ClassroomsPage from './pages/classrooms/ClassroomsPage';
import CourseRepDashboardPage from './pages/course-rep-dashboard/CourseRepDashboardPage';
import SessionsPage from './pages/course-rep-dashboard/SessionsPage';
import GlobalRosterAuditPage from './pages/GlobalRosterAuditPage';
import AdminsPage from './pages/admins/AdminsPage';
import SettingsPage from './pages/settings/SettingsPage';
import PublicRegistrationPage from './pages/public-registration/PublicRegistrationPage';
import PublicCheckInPage from './pages/public-check-in/PublicCheckInPage';
import LandingPage from './pages/LandingPage';
import type { ReactNode } from 'react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

/** Redirects to /login if the user is not authenticated. */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Only allows ADMIN users. */
function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role !== 'ADMIN') return <Navigate to="/course-rep-dashboard" replace />;
  return <>{children}</>;
}

/** Only allows COURSE_REP users. */
function CourseRepRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, role } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (role === 'ADMIN') return <Navigate to="/course-reps" replace />;
  if (role !== 'COURSE_REP') return <Navigate to="/login" replace />;
  return <>{children}</>;
}

/** Root route that conditionally renders LandingPage or redirects to /login based on admin setting */
function RootRoute() {
  const { data: settings, isLoading } = useQuery<{ enableLandingPage: boolean }>({
    queryKey: ['public-settings'],
    queryFn: () => apiClient.get('/public/settings').then((r) => r.data),
    staleTime: 60_000,
  });

  if (isLoading) {
    return null;
  }

  if (settings && !settings.enableLandingPage) {
    return <Navigate to="/login" replace />;
  }

  return <LandingPage />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/public/register/:classId" element={<PublicRegistrationPage />} />
            <Route path="/check-in" element={<PublicCheckInPage />} />
            <Route path="/check-in/:sessionId" element={<PublicCheckInPage />} />

            {/* Admin routes */}
            <Route
              element={
                <AdminRoute>
                  <DashboardLayout />
                </AdminRoute>
              }
            >
              <Route path="/course-reps" element={<CourseRepsPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/classrooms" element={<ClassroomsPage />} />
              <Route path="/all-students" element={<GlobalRosterAuditPage />} />
              <Route path="/global-roster" element={<Navigate to="/all-students" replace />} />
              <Route path="/admins" element={<AdminsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>

            {/* CourseRep routes */}
            <Route
              element={
                <CourseRepRoute>
                  <CourseRepDashboardLayout />
                </CourseRepRoute>
              }
            >
              <Route path="/course-rep-dashboard" element={<CourseRepDashboardPage />} />
              <Route path="/course-rep-dashboard/sessions" element={<SessionsPage />} />
            </Route>

            {/* Default redirect */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
