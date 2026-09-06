import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';

const { Title, Text } = Typography;

export default function PasswordChangePage() {
  const [loading, setLoading] = useState(false);
  const { user, changePassword, logout } = useAuthStore();
  const navigate = useNavigate();

  const onFinish = async (values: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      message.success('密码修改成功，请重新登录');
      await logout();
      navigate('/login', { replace: true });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '密码修改失败';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card style={{ width: 440 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 8 }}>修改密码</Title>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
          {user?.mustChangePassword ? '首次登录或密码重置后，请先修改密码' : '修改您的密码'}
        </Text>
        <Form onFinish={onFinish} autoComplete="off" size="large">
          <Form.Item name="currentPassword" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="当前密码" />
          </Form.Item>
          <Form.Item name="newPassword" rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码至少8位' },
            { pattern: /[a-zA-Z]/, message: '密码必须包含字母' },
            { pattern: /[0-9]/, message: '密码必须包含数字' },
          ]}>
            <Input.Password prefix={<LockOutlined />} placeholder="新密码（至少8位，包含字母和数字）" />
          </Form.Item>
          <Form.Item name="confirmPassword" rules={[{ required: true, message: '请确认新密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="确认新密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              修改密码
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
