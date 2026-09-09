import { useState, useEffect } from 'react';
import { Card, Descriptions, Button, Form, Input, message, Spin, Tag, Space } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { getCurrentUser } from '@/api/auth';
import { updateContact } from '@/api/me';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  // Refresh user data on mount
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getCurrentUser()
      .then((freshUser) => {
        setUser(freshUser);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = () => {
    form.setFieldsValue({
      workEmail: user?.workEmail || '',
      phone: user?.phone || '',
    });
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    form.resetFields();
  };

  const handleSave = async () => {
    try {
      setSubmitting(true);
      const values = await form.validateFields();
      // Normalize empty strings to null
      const workEmail = values.workEmail?.trim() || null;
      const phone = values.phone?.trim() || null;

      const updatedUser = await updateContact(workEmail, phone);
      setUser(updatedUser);
      setEditing(false);
      message.success('联系方式更新成功');
    } catch (err: any) {
      if (err?.response?.data?.error) {
        message.error(err.response.data.error.message || '保存失败');
      } else if (err?.errorFields) {
        // Form validation error - don't show extra message
      } else {
        message.error('保存失败，请重试');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) return null;

  const roleLabel = user.role === 'ADMIN' ? '管理员' : '员工';
  const statusLabel = user.status === 'ENABLED' ? '正常' : '已停用';
  const statusColor = user.status === 'ENABLED' ? 'green' : 'red';

  return (
    <Spin spinning={loading}>
      <Card
        title={
          <Space>
            <UserOutlined />
            <span>个人资料</span>
          </Space>
        }
        extra={
          !editing && (
            <Button type="primary" icon={<EditOutlined />} onClick={handleEdit}>
              编辑联系方式
            </Button>
          )
        }
      >
        {editing ? (
          <Form form={form} layout="vertical" style={{ maxWidth: 480 }}>
            <Form.Item label="姓名">
              <Input value={user.name} disabled />
            </Form.Item>
            <Form.Item label="登录账号">
              <Input value={user.username} disabled />
            </Form.Item>
            <Form.Item label="角色">
              <Input value={roleLabel} disabled />
            </Form.Item>
            <Form.Item label="所属部门">
              <Input value={user.department?.name || '不适用'} disabled />
            </Form.Item>
            <Form.Item label="职务">
              <Input value={user.jobTitle || '-'} disabled />
            </Form.Item>
            <Form.Item
              name="workEmail"
              label="工作邮箱"
              rules={[
                { type: 'email', message: '请输入正确的邮箱格式' },
              ]}
            >
              <Input placeholder="请输入工作邮箱" allowClear />
            </Form.Item>
            <Form.Item
              name="phone"
              label="联系电话"
              rules={[
                { max: 30, message: '联系电话最多 30 个字符' },
              ]}
            >
              <Input placeholder="请输入联系电话" allowClear />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={submitting}
                >
                  保存
                </Button>
                <Button icon={<CloseOutlined />} onClick={handleCancel} disabled={submitting}>
                  取消
                </Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <Descriptions column={1} bordered size="middle">
            <Descriptions.Item label="姓名">{user.name}</Descriptions.Item>
            <Descriptions.Item label="登录账号">{user.username}</Descriptions.Item>
            <Descriptions.Item label="角色">
              <Tag color={user.role === 'ADMIN' ? 'blue' : 'green'}>{roleLabel}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="部门负责人">
              {user.isDepartmentManager ? <Tag color="orange">是</Tag> : '否'}
            </Descriptions.Item>
            <Descriptions.Item label="所属部门">
              {user.department?.name || '不适用'}
            </Descriptions.Item>
            <Descriptions.Item label="职务">{user.jobTitle || '-'}</Descriptions.Item>
            <Descriptions.Item label="工作邮箱">{user.workEmail || '-'}</Descriptions.Item>
            <Descriptions.Item label="联系电话">{user.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="账号状态">
              <Tag color={statusColor}>{statusLabel}</Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Card>
    </Spin>
  );
}
