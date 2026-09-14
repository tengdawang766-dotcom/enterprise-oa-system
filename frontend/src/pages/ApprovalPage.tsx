import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Tabs, Tag, Button, Space, Modal, Input, message, Badge, Typography, Result,
} from 'antd';
import { CheckOutlined, CloseOutlined, EyeOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { LeaveRequest } from '@/types';
import { getApprovalTasks, getApprovalHistory, approveLeave, rejectLeave } from '@/api/leave';
import { useAuthStore } from '@/stores/auth';

const { Title } = Typography;
const { TextArea } = Input;

import { LEAVE_STATUS_LABEL, LEAVE_STATUS_COLOR, LEAVE_TYPE_LABEL } from '@/utils/status-labels';

export default function ApprovalPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('pending');

  // Error state
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Pending tasks state
  const [pendingData, setPendingData] = useState<LeaveRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingTotal, setPendingTotal] = useState(0);
  const pageSize = 10;

  // History state
  const [historyData, setHistoryData] = useState<LeaveRequest[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  const fetchPending = useCallback(async (p = 1) => {
    setPendingLoading(true);
    setPendingError(null);
    try {
      const result = await getApprovalTasks({ page: p, pageSize });
      setPendingData(result.items);
      setPendingTotal(result.pagination.total);
      setPendingPage(result.pagination.page);
    } catch (err: any) {
      setPendingError(err?.response?.data?.error?.message || '加载待审批列表失败');
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (p = 1) => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const result = await getApprovalHistory({ page: p, pageSize });
      setHistoryData(result.items);
      setHistoryTotal(result.pagination.total);
      setHistoryPage(result.pagination.page);
    } catch (err: any) {
      setHistoryError(err?.response?.data?.error?.message || '加载审批历史失败');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user?.isDepartmentManager) return;
    fetchPending(1);
    fetchHistory(1);
  }, [fetchPending, fetchHistory, user?.isDepartmentManager]);

  // Guard: non-managers cannot access approval page
  if (!user?.isDepartmentManager) {
    return (
      <Result
        status="403"
        title="无权限"
        subTitle="您不是部门负责人，无法访问审批管理页面"
        extra={<Button onClick={() => navigate('/app/dashboard')}>返回工作台</Button>}
      />
    );
  }

  const handleApprove = (record: LeaveRequest) => {
    let commentValue = '';
    Modal.confirm({
      title: '审批通过',
      content: (
        <div>
          <p>确认通过 {record.applicant?.name} 的请假申请？</p>
          <TextArea
            rows={3}
            placeholder="审批意见（可选）"
            onChange={(e) => { commentValue = e.target.value; }}
          />
        </div>
      ),
      okText: '确认通过',
      cancelText: '取消',
      onOk: async () => {
        try {
          await approveLeave(record.id, record.stateVersion, commentValue || undefined);
          message.success('审批通过');
          fetchPending(pendingPage);
          fetchHistory(1);
        } catch (err: any) {
          message.error(err?.response?.data?.error?.message || '操作失败');
          throw err; // prevent modal from closing
        }
      },
    });
  };

  const handleReject = (record: LeaveRequest) => {
    let reasonValue = '';

    Modal.confirm({
      title: '驳回申请',
      content: (
        <div>
          <p>请填写驳回原因：</p>
          <TextArea
            rows={3}
            placeholder="驳回原因（必填）"
            onChange={(e) => { reasonValue = e.target.value; }}
          />
        </div>
      ),
      okText: '确认驳回',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const trimmed = reasonValue.trim();
        if (!trimmed) {
          message.warning('请填写驳回原因');
          return Promise.reject(new Error('reason required'));
        }
        try {
          await rejectLeave(record.id, record.stateVersion, trimmed);
          message.success('已驳回');
          fetchPending(pendingPage);
          fetchHistory(1);
        } catch (err: any) {
          message.error(err?.response?.data?.error?.message || '操作失败');
          throw err;
        }
      },
    });
  };

  const pendingColumns: ColumnsType<LeaveRequest> = [
    {
      title: '申请人',
      dataIndex: ['applicant', 'name'],
      key: 'applicant',
      render: (_, record) => record.applicant?.name || '-',
    },
    {
      title: '部门',
      dataIndex: ['submittedDepartment', 'name'],
      key: 'department',
      render: (_, record) => record.submittedDepartment?.name || '-',
    },
    {
      title: '请假类型',
      dataIndex: 'leaveType',
      key: 'leaveType',
      render: (val: string) => LEAVE_TYPE_LABEL[val] || val,
    },
    {
      title: '起止日期',
      key: 'dates',
      render: (_, record) => `${record.startDate} ~ ${record.endDate}`,
    },
    {
      title: '天数',
      dataIndex: 'days',
      key: 'days',
      width: 70,
    },
    {
      title: '事由',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/app/approvals/${record.id}`)}
          >
            查看
          </Button>
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            style={{ color: '#52c41a' }}
            onClick={() => handleApprove(record)}
          >
            通过
          </Button>
          <Button
            type="link"
            size="small"
            danger
            icon={<CloseOutlined />}
            onClick={() => handleReject(record)}
          >
            驳回
          </Button>
        </Space>
      ),
    },
  ];

  const historyColumns: ColumnsType<LeaveRequest> = [
    {
      title: '申请人',
      dataIndex: ['applicant', 'name'],
      key: 'applicant',
      render: (_, record) => record.applicant?.name || '-',
    },
    {
      title: '部门',
      dataIndex: ['submittedDepartment', 'name'],
      key: 'department',
      render: (_, record) => record.submittedDepartment?.name || '-',
    },
    {
      title: '请假类型',
      dataIndex: 'leaveType',
      key: 'leaveType',
      render: (val: string) => LEAVE_TYPE_LABEL[val] || val,
    },
    {
      title: '起止日期',
      key: 'dates',
      render: (_, record) => `${record.startDate} ~ ${record.endDate}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (val: string) => {
        return <Tag color={LEAVE_STATUS_COLOR[val] || 'default'}>{LEAVE_STATUS_LABEL[val] || val}</Tag>;
      },
    },
    {
      title: '审批意见',
      key: 'comment',
      ellipsis: true,
      render: (_, record) => record.finalAction?.comment || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/app/approvals/${record.id}`)}
        >
          查看
        </Button>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'pending',
      label: (
        <Badge count={pendingTotal} offset={[6, 0]} size="small">
          <span>待审批</span>
        </Badge>
      ),
      children: (
        pendingError && pendingData.length === 0 ? (
          <Result
            status="error"
            title="加载失败"
            subTitle={pendingError}
            extra={<Button onClick={() => fetchPending(pendingPage)}>重试</Button>}
          />
        ) : (
        <Table
          rowKey="id"
          columns={pendingColumns}
          dataSource={pendingData}
          loading={pendingLoading}
          pagination={{
            current: pendingPage,
            pageSize,
            total: pendingTotal,
            onChange: (p) => fetchPending(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
        )
      ),
    },
    {
      key: 'history',
      label: '审批历史',
      children: (
        historyError && historyData.length === 0 ? (
          <Result
            status="error"
            title="加载失败"
            subTitle={historyError}
            extra={<Button onClick={() => fetchHistory(historyPage)}>重试</Button>}
          />
        ) : (
        <Table
          rowKey="id"
          columns={historyColumns}
          dataSource={historyData}
          loading={historyLoading}
          pagination={{
            current: historyPage,
            pageSize,
            total: historyTotal,
            onChange: (p) => fetchHistory(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
        />
        )
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <Title level={4} style={{ marginBottom: 16 }}>
        审批管理
      </Title>
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />
    </div>
  );
}
