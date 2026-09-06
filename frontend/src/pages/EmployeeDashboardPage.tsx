import { Card, Typography } from 'antd';
import { useAuthStore } from '@/stores/auth';

const { Title, Text } = Typography;

/**
 * Temporary employee dashboard (Day 2 placeholder).
 * Will be replaced with real dashboard in later development.
 */
export default function EmployeeDashboardPage() {
  const { user } = useAuthStore();

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 480, textAlign: 'center' }}>
        <Title level={3}>欢迎回来，{user?.name || user?.username}</Title>
        <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
          个人工作台正在建设中，敬请期待...
        </Text>
      </Card>
    </div>
  );
}
