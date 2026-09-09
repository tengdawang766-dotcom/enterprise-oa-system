import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';
import AuthGuard from '@/components/guards/AuthGuard';
import GuestGuard from '@/components/guards/GuestGuard';
import RoleGuard from '@/components/guards/RoleGuard';
import PasswordChangeGuard from '@/components/guards/PasswordChangeGuard';
import AdminLayout from '@/layouts/AdminLayout';
import EmployeeLayout from '@/layouts/EmployeeLayout';
import LoginPage from '@/pages/LoginPage';
import PasswordChangePage from '@/pages/PasswordChangePage';
import EmployeeDashboardPage from '@/pages/EmployeeDashboardPage';
import NotFoundPage from '@/pages/NotFoundPage';
import NoPermissionPage from '@/pages/NoPermissionPage';
import DepartmentPage from '@/pages/admin/DepartmentPage';
import EmployeePage from '@/pages/admin/EmployeePage';
import AnnouncementManagementPage from '@/pages/admin/AnnouncementManagementPage';
import AnnouncementListPage from '@/pages/AnnouncementListPage';
import AnnouncementDetailPage from '@/pages/AnnouncementDetailPage';
import DirectoryPage from '@/pages/DirectoryPage';
import MyLeaveListPage from '@/pages/MyLeaveListPage';
import LeaveFormPage from '@/pages/LeaveFormPage';
import LeaveDetailPage from '@/pages/LeaveDetailPage';
import ApprovalPage from '@/pages/ApprovalPage';

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

        {/* Employee routes (includes department managers as EMPLOYEE role) */}
        <Route
          path="/app"
          element={
            <AuthGuard>
              <PasswordChangeGuard>
                <RoleGuard roles={['EMPLOYEE']}>
                  <EmployeeLayout />
                </RoleGuard>
              </PasswordChangeGuard>
            </AuthGuard>
          }
        >
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<EmployeeDashboardPage />} />
          <Route path="announcements" element={<AnnouncementListPage />} />
          <Route path="announcements/:id" element={<AnnouncementDetailPage />} />
          <Route path="directory" element={<DirectoryPage />} />
          <Route path="leave" element={<MyLeaveListPage />} />
          <Route path="leave/new" element={<LeaveFormPage />} />
          <Route path="leave/:id/edit" element={<LeaveFormPage />} />
          <Route path="leave/:id" element={<LeaveDetailPage />} />
          <Route path="approvals" element={<ApprovalPage />} />
          <Route path="approvals/:id" element={<LeaveDetailPage />} />
        </Route>

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
          <Route path="announcements" element={<AnnouncementManagementPage />} />
          <Route path="directory" element={<DirectoryPage />} />
        </Route>

        {/* Default: redirect to login — GuestGuard handles authenticated redirects */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
