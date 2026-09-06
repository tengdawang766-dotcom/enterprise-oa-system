import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export default function NoPermissionPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const handleGoHome = async () => {
    if (user?.role === 'ADMIN') {
      navigate('/app/admin/departments');
    } else if (user) {
      navigate('/app/dashboard');
    } else {
      navigate('/login');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <Result
      status="403"
      title="403"
      subTitle="抱歉，您没有权限访问此页面"
      extra={
        <>
          <Button type="primary" onClick={handleGoHome}>返回首页</Button>
          <Button onClick={handleLogout}>重新登录</Button>
        </>
      }
    />
  );
}
