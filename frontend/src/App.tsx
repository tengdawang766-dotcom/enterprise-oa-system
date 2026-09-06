import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import AuthGuard from '@/components/guards/AuthGuard';
import GuestGuard from '@/components/guards/GuestGuard';
import RoleGuard from '@/components/guards/RoleGuard';
import PasswordChangeGuard from '@/components/guards/PasswordChangeGuard';
import AdminLayout from '@/layouts/AdminLayout';
import LoginPage from '@/pages/LoginPage';
import PasswordChangePage from '@/pages/PasswordChangePage';
import EmployeeDashboardPage from '@/pages/EmployeeDashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';
import NoPermissionPage from '@/pages/NoPermissionPage';
import DepartmentPage from '@/pages/admin/DepartmentPage';
import EmployeePage from '@/pages/admin/EmployeePage';

export default function App() {
  const { initAuth, initialized } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      initAuth();
    }
  }, [initialized, initAuth]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<GuestGuard><LoginPage /></GuestGuard>} />
        <Route path="/change-password" element={<AuthGuard><PasswordChangePage /></AuthGuard>} />
        <Route path="/no-permission" element={<NoPermissionPage />} />

        {/* Employee dashboard (accessible by all authenticated users) */}
        <Route
          path="/app/dashboard"
          element={
            <AuthGuard>
              <PasswordChangeGuard>
                <EmployeeDashboardPage />
              </PasswordChangeGuard>
            </AuthGuard>
          }
        />

        {/* Admin routes */}
        <Route
          path="/app/admin"
          element={
            <AuthGuard>
              <PasswordChangeGuard>
                <RoleGuard roles={['ADMIN']}>
                  <AdminLayout />
                </RoleGuard>
              </PasswordChangeGuard>
            </AuthGuard>
          }
        >
          <Route index element={<Navigate to="departments" replace />} />
          <Route path="departments" element={<DepartmentPage />} />
          <Route path="employees" element={<EmployeePage />} />
        </Route>

        {/* Default: redirect to login — GuestGuard handles authenticated redirects */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/app" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
