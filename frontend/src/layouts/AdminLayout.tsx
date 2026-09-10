import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Space, Typography } from 'antd';
import {
  TeamOutlined,
  BankOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MailOutlined,
  PhoneOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const adminMenuItems: MenuProps['items'] = [
  {
    key: '/app/admin/departments',
    icon: <BankOutlined />,
    label: '部门管理',
  },
  {
    key: '/app/admin/employees',
    icon: <TeamOutlined />,
    label: '员工管理',
  },
  {
    key: '/app/admin/announcements',
    icon: <MailOutlined />,
    label: '公告管理',
  },
  {
    key: '/app/admin/directory',
    icon: <PhoneOutlined />,
    label: '通讯录',
  },
];

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKeys = useMemo(() => {
    const match = [...(adminMenuItems ?? [])].reverse().find(
      (item) => item && location.pathname.startsWith((item as { key: string }).key)
    );
    return match ? [(match as { key: string }).key] : [];
  }, [location.pathname]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => navigate('/app/admin/profile'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme="dark">
        <div style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text strong style={{ color: '#fff', fontSize: collapsed ? 14 : 18 }}>
            {collapsed ? 'OA' : '企业 OA 系统'}
          </Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          items={adminMenuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 24px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer', fontSize: 18 }}>
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </span>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <Text>{user?.name}</Text>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 280 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
