import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Tag,
  List,
  Button,
  Spin,
  Alert,
  Space,
  Empty,
} from 'antd';
import {
  MailOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  AuditOutlined,
  PlusOutlined,
  PhoneOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { getDashboard, type DashboardData } from '@/api/dashboard';
import dayjs from 'dayjs';
import { formatDateTime, formatShortDate } from '@/utils/date-format';

const { Title, Text } = Typography;

import { LEAVE_TYPE_LABEL, LEAVE_STATUS_LABEL, LEAVE_STATUS_COLOR } from '@/utils/status-labels';

export default function EmployeeDashboardPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDashboard();
      setData(result);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '加载工作台数据失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Alert
          type="error"
          message="加载失败"
          description={error}
          showIcon
          action={
            <Button icon={<ReloadOutlined />} onClick={fetchData}>
              重试
            </Button>
          }
        />
      </div>
    );
  }

  if (!data) return null;

  const isManager = data.user.isDepartmentManager;

  return (
    <div>
      {/* Welcome section */}
      <div style={{ marginBottom: 24 }}>
        <Title level={4} style={{ marginBottom: 4 }}>
          欢迎回来，{data.user.name}
        </Title>
        <Space>
          {data.user.departmentName && (
            <Text type="secondary">所属部门：{data.user.departmentName}</Text>
          )}
          {isManager && <Tag color="orange">部门负责人</Tag>}
          <Text type="secondary">|</Text>
          <Text type="secondary">{dayjs().format('YYYY年MM月DD日 dddd')}</Text>
        </Space>
      </div>

      {/* Stats cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={isManager ? 6 : 8}>
          <Card hoverable onClick={() => navigate('/app/announcements?readStatus=UNREAD')}>
            <Statistic
              title="未读公告"
              value={data.unreadAnnouncementCount}
              prefix={<MailOutlined />}
              styles={{ content: { color: '#1890ff' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={isManager ? 6 : 8}>
          <Card hoverable onClick={() => navigate('/app/leave?status=PENDING')}>
            <Statistic
              title="我的待审批"
              value={data.myLeaveStats.pending}
              prefix={<ClockCircleOutlined />}
              styles={{ content: { color: '#faad14' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={isManager ? 6 : 8}>
          <Card hoverable onClick={() => navigate('/app/leave?status=APPROVED')}>
            <Statistic
              title="已通过请假"
              value={data.myLeaveStats.approved}
              prefix={<CheckCircleOutlined />}
              styles={{ content: { color: '#52c41a' } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={isManager ? 6 : 8}>
          <Card hoverable onClick={() => navigate('/app/leave?status=REJECTED')}>
            <Statistic
              title="已驳回请假"
              value={data.myLeaveStats.rejected}
              prefix={<CloseCircleOutlined />}
              styles={{ content: { color: '#ff4d4f' } }}
            />
          </Card>
        </Col>
        {isManager && (
          <Col xs={24} sm={12} md={6}>
            <Card hoverable onClick={() => navigate('/app/approvals')}>
              <Statistic
                title="待我审批"
                value={data.pendingApprovalCount ?? 0}
                prefix={<AuditOutlined />}
                styles={{ content: { color: '#722ed1' } }}
              />
            </Card>
          </Col>
        )}
      </Row>

      {/* Content area */}
      <Row gutter={[16, 16]}>
        {/* Recent announcements */}
        <Col xs={24} lg={12}>
          <Card
            title="最近公告"
            extra={<Button type="link" onClick={() => navigate('/app/announcements')}>查看全部</Button>}
          >
            {data.recentAnnouncements.length === 0 ? (
              <Empty description="暂无公告" />
            ) : (
              <List
                dataSource={data.recentAnnouncements}
                renderItem={(item) => (
                  <List.Item
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/app/announcements/${item.id}`)}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{item.title}</span>
                          {item.read ? (
                            <Tag color="default">已读</Tag>
                          ) : (
                            <Tag color="blue">未读</Tag>
                          )}
                        </Space>
                      }
                      description={
                        item.publishedAt
                          ? formatDateTime(item.publishedAt)
                          : '-'
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>

        {/* Recent leaves */}
        <Col xs={24} lg={12}>
          <Card
            title="最近请假"
            extra={
              <Space>
                <Button type="link" onClick={() => navigate('/app/leave')}>查看全部</Button>
                <Button
                  type="primary"
                  size="small"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/app/leave/new')}
                >
                  新建请假
                </Button>
              </Space>
            }
          >
            {data.recentLeaves.length === 0 ? (
              <Empty description="暂无请假记录" />
            ) : (
              <List
                dataSource={data.recentLeaves}
                renderItem={(item) => (
                  <List.Item
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/app/leave/${item.id}`)}
                  >
                    <List.Item.Meta
                      title={
                        <Space>
                          <span>{LEAVE_TYPE_LABEL[item.leaveType] || item.leaveType}</span>
                          <Tag color={LEAVE_STATUS_COLOR[item.status]}>
                            {LEAVE_STATUS_LABEL[item.status] || item.status}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space>
                          <span>
                            {formatShortDate(item.startDate)} ~ {formatShortDate(item.endDate)}
                          </span>
                          <span>{item.days}天</span>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Manager pending approvals section */}
      {isManager && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col span={24}>
            <Card
              title="待我审批"
              extra={
                <Button type="primary" icon={<AuditOutlined />} onClick={() => navigate('/app/approvals')}>
                  进入审批
                </Button>
              }
            >
              {(!data.recentPendingApprovals || data.recentPendingApprovals.length === 0) ? (
                <Empty description="暂无待审批申请" />
              ) : (
                <List
                  dataSource={data.recentPendingApprovals}
                  renderItem={(item) => (
                    <List.Item
                      style={{ cursor: 'pointer' }}
                      onClick={() => navigate(`/app/approvals/${item.id}`)}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <span>{item.applicantName}</span>
                            <Tag>{LEAVE_TYPE_LABEL[item.leaveType] || item.leaveType}</Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            <span>
                              {formatShortDate(item.startDate)} ~ {formatShortDate(item.endDate)} · {item.days}天
                            </span>
                            <Text type="secondary" ellipsis style={{ maxWidth: 400 }}>
                              {item.reason}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* Quick actions */}
      <Card title="常用入口" style={{ marginTop: 16 }}>
        <Space wrap>
          <Button icon={<PlusOutlined />} onClick={() => navigate('/app/leave/new')}>
            新建请假
          </Button>
          <Button icon={<FileTextOutlined />} onClick={() => navigate('/app/leave')}>
            我的请假
          </Button>
          <Button icon={<MailOutlined />} onClick={() => navigate('/app/announcements')}>
            公告
          </Button>
          <Button icon={<PhoneOutlined />} onClick={() => navigate('/app/directory')}>
            通讯录
          </Button>
          {isManager && (
            <Button icon={<AuditOutlined />} onClick={() => navigate('/app/approvals')}>
              请假审批
            </Button>
          )}
        </Space>
      </Card>
    </div>
  );
}
