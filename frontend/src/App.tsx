import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '@/stores/auth';
import AuthGuard from '@/components/guards/AuthGuard';
import GuestGuard from '@/components/guards/GuestGuard';
import RoleGuard from '@/components/guards/RoleGuard';
import PasswordChangeGuard from '@/components/guards/PasswordChangeGuard';
import ErrorBoundary from '@/components/ErrorBoundary';
import AdminLayout from '@/layouts/AdminLayout';
import EmployeeLayout from '@/layouts/EmployeeLayout';
import LoginPage from '@/pages/LoginPage';
import PasswordChangePage from '@/pages/PasswordChangePage';
import NotFoundPage from '@/pages/NotFoundPage';
import NoPermissionPage from '@/pages/NoPermissionPage';

// Lazy-loaded pages (route-level code splitting)
const EmployeeDashboardPage = lazy(() => import('@/pages/EmployeeDashboardPage'));
const DepartmentPage = lazy(() => import('@/pages/admin/DepartmentPage'));
const EmployeePage = lazy(() => import('@/pages/admin/EmployeePage'));
const AnnouncementManagementPage = lazy(() => import('@/pages/admin/AnnouncementManagementPage'));
const AnnouncementListPage = lazy(() => import('@/pages/AnnouncementListPage'));
const AnnouncementDetailPage = lazy(() => import('@/pages/AnnouncementDetailPage'));
const DirectoryPage = lazy(() => import('@/pages/DirectoryPage'));
const MyLeaveListPage = lazy(() => import('@/pages/MyLeaveListPage'));
const LeaveFormPage = lazy(() => import('@/pages/LeaveFormPage'));
const LeaveDetailPage = lazy(() => import('@/pages/LeaveDetailPage'));
const ApprovalPage = lazy(() => import('@/pages/ApprovalPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));

function PageLoading() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
      <Spin size="large" />
    </div>
  );
}

export default function App() {
  const { initAuth, initialized } = useAuthStore();

  useEffect(() => {
    if (!initialized) {
      initAuth();
    }
  }, [initialized, initAuth]);

  return (
    <ErrorBoundary>
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
            <Route path="dashboard" element={<Suspense fallback={<PageLoading />}><EmployeeDashboardPage /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<PageLoading />}><ProfilePage /></Suspense>} />
            <Route path="announcements" element={<Suspense fallback={<PageLoading />}><AnnouncementListPage /></Suspense>} />
            <Route path="announcements/:id" element={<Suspense fallback={<PageLoading />}><AnnouncementDetailPage /></Suspense>} />
            <Route path="directory" element={<Suspense fallback={<PageLoading />}><DirectoryPage /></Suspense>} />
            <Route path="leave" element={<Suspense fallback={<PageLoading />}><MyLeaveListPage /></Suspense>} />
            <Route path="leave/new" element={<Suspense fallback={<PageLoading />}><LeaveFormPage /></Suspense>} />
            <Route path="leave/:id/edit" element={<Suspense fallback={<PageLoading />}><LeaveFormPage /></Suspense>} />
            <Route path="leave/:id" element={<Suspense fallback={<PageLoading />}><LeaveDetailPage /></Suspense>} />
            <Route path="approvals" element={<Suspense fallback={<PageLoading />}><ApprovalPage /></Suspense>} />
            <Route path="approvals/:id" element={<Suspense fallback={<PageLoading />}><LeaveDetailPage /></Suspense>} />
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
            <Route path="departments" element={<Suspense fallback={<PageLoading />}><DepartmentPage /></Suspense>} />
            <Route path="employees" element={<Suspense fallback={<PageLoading />}><EmployeePage /></Suspense>} />
            <Route path="announcements" element={<Suspense fallback={<PageLoading />}><AnnouncementManagementPage /></Suspense>} />
            <Route path="directory" element={<Suspense fallback={<PageLoading />}><DirectoryPage /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<PageLoading />}><ProfilePage /></Suspense>} />
          </Route>

          {/* Default: redirect to login — GuestGuard handles authenticated redirects */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
