import { Button, Result } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth';

export default function NotFoundPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const handleGoHome = () => {
    if (user?.role === 'ADMIN') {
      navigate('/app/admin/departments');
    } else if (user) {
      navigate('/app/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <Result
      status="404"
      title="404"
      subTitle="页面不存在"
      extra={<Button type="primary" onClick={handleGoHome}>返回首页</Button>}
    />
  );
}
