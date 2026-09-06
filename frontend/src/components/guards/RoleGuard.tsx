import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

interface Props {
  roles: Array<'ADMIN' | 'EMPLOYEE'>;
  children: React.ReactNode;
}

export default function RoleGuard({ roles, children }: Props) {
  const { user } = useAuthStore();

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/no-permission" replace />;
  }

  return <>{children}</>;
}
