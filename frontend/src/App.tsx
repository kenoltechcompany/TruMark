import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import DashboardLayout from './components/DashboardLayout';
import CourseRepDashboardLayout from './components/CourseRepDashboardLayout';
import LoginPage from './pages/LoginPage';
import CourseRepsPage from './pages/course-reps/CourseRepsPage';
import ClassesPage from './pages/classes/ClassesPage';
import ClassroomsPage from './pages/classrooms/ClassroomsPage';
import CourseRepDashboardPage from './pages/course-rep-dashboard/CourseRepDashboardPage';
import SessionsPage from './pages/course-rep-dashboard/SessionsPage';
import GlobalRosterAuditPage from './pages/GlobalRosterAuditPage';
import PublicRegistrationPage from './pages/public-registration/PublicRegistrationPage';
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

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/public/register/:classId" element={<PublicRegistrationPage />} />

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
              <Route path="/global-roster" element={<GlobalRosterAuditPage />} />
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
