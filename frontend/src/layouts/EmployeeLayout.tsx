import { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Dropdown, Avatar, Space, Typography } from 'antd';
import {
  MailOutlined,
  PhoneOutlined,
  DashboardOutlined,
  UserOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileTextOutlined,
  AuditOutlined,
  ReadOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

function getEmployeeMenuItems(isManager: boolean): MenuProps['items'] {
  const items: MenuProps['items'] = [
    {
      key: '/app/dashboard',
      icon: <DashboardOutlined />,
      label: '工作台',
    },
    {
      key: '/app/announcements',
      icon: <MailOutlined />,
      label: '公告',
    },
    {
      key: '/app/leave',
      icon: <FileTextOutlined />,
      label: '我的请假',
    },
  ];

  if (isManager) {
    items!.push({
      key: '/app/approvals',
      icon: <AuditOutlined />,
      label: '请假审批',
    });
  }

  items!.push({
    key: '/app/directory',
    icon: <PhoneOutlined />,
    label: '通讯录',
  });

  items!.push({
    key: '/app/knowledge',
    icon: <ReadOutlined />,
    label: '知识分享',
  });

  return items;
}

export default function EmployeeLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isManager = user?.isDepartmentManager ?? false;
  const menuItems = getEmployeeMenuItems(isManager);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => navigate('/app/profile'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  // Determine selected key from path (memoized to avoid infinite re-renders)
  const selectedKeys = useMemo(() => {
    const path = location.pathname;
    if (path.startsWith('/app/announcements')) return ['/app/announcements'];
    if (path.startsWith('/app/leave')) return ['/app/leave'];
    if (path.startsWith('/app/approvals')) return ['/app/approvals'];
    if (path.startsWith('/app/directory')) return ['/app/directory'];
    if (path.startsWith('/app/knowledge')) return ['/app/knowledge'];
    return ['/app/dashboard'];
  }, [location.pathname]);

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
          items={menuItems}
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
