import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Tag, Button, Space, Modal, Select, Result, Empty, message, Tooltip } from 'antd';
import { PlusOutlined, FileTextOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { LeaveRequest } from '@/types';
import { getMyLeaves, cancelLeave, resubmitLeave } from '@/api/leave';

const STATUS_OPTIONS = [
  { value: '', label: '全部状态' },
  { value: 'PENDING', label: '审批中' },
  { value: 'APPROVED', label: '已通过' },
  { value: 'REJECTED', label: '已驳回' },
  { value: 'CANCELLED', label: '已撤回' },
];

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'processing',
  APPROVED: 'success',
  REJECTED: 'error',
  CANCELLED: 'default',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: '审批中',
  APPROVED: '已通过',
  REJECTED: '已驳回',
  CANCELLED: '已撤回',
};

const LEAVE_TYPE_LABEL: Record<string, string> = {
  PERSONAL: '事假',
  SICK: '病假',
  ANNUAL: '年假',
};

export default function MyLeaveListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMyLeaves({
        page: p,
        pageSize,
        status: statusFilter || undefined,
      });
      setData(result.items);
      setTotal(result.pagination.total);
      setPage(result.pagination.page);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '加载请假列表失败';
      setError(msg);
      message.error(msg);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const handleCancel = (record: LeaveRequest) => {
    Modal.confirm({
      title: '确认撤回',
      content: `确定要撤回这条${LEAVE_TYPE_LABEL[record.leaveType] || record.leaveType}申请吗？`,
      okText: '确认撤回',
      cancelText: '取消',
      okType: 'danger',
      onOk: async () => {
        try {
          await cancelLeave(record.id, record.stateVersion);
          message.success('撤回成功');
          fetchData(page);
        } catch (err: any) {
          message.error(err?.response?.data?.error?.message || '撤回失败');
        }
      },
    });
  };

  const handleResubmit = (record: LeaveRequest) => {
    Modal.confirm({
      title: '确认重新提交',
      content: `确定要重新提交这条${LEAVE_TYPE_LABEL[record.leaveType] || record.leaveType}申请吗？`,
      okText: '确认提交',
      cancelText: '取消',
      onOk: async () => {
        try {
          await resubmitLeave(record.id, record.stateVersion);
          message.success('重新提交成功');
          fetchData(page);
        } catch (err: any) {
          message.error(err?.response?.data?.error?.message || '重新提交失败');
        }
      },
    });
  };

  const getActions = (record: LeaveRequest) => {
    const actions: React.ReactNode[] = [];
    actions.push(
      <Button key="view" type="link" size="small" onClick={() => navigate(`/app/leave/${record.id}`)}>
        查看
      </Button>
    );
    if (record.status === 'PENDING') {
      actions.push(
        <Button key="cancel" type="link" size="small" danger onClick={() => handleCancel(record)}>
          撤回
        </Button>
      );
    }
    if (record.status === 'CANCELLED') {
      actions.push(
        <Button key="edit" type="link" size="small" onClick={() => navigate(`/app/leave/${record.id}/edit`)}>
          编辑
        </Button>
      );
      actions.push(
        <Button key="resubmit" type="link" size="small" onClick={() => handleResubmit(record)}>
          重新提交
        </Button>
      );
    }
    return actions;
  };

  const columns: ColumnsType<LeaveRequest> = [
    {
      title: '请假类型',
      dataIndex: 'leaveType',
      key: 'leaveType',
      width: 100,
      render: (val: string) => LEAVE_TYPE_LABEL[val] || val,
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      width: 120,
      render: (val: string) => val?.slice(0, 10),
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      width: 120,
      render: (val: string) => val?.slice(0, 10),
    },
    {
      title: '天数',
      dataIndex: 'days',
      key: 'days',
      width: 70,
      align: 'center',
    },
    {
      title: '事由',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true,
      render: (val: string) => (
        <Tooltip title={val} placement="topLeft">
          {val}
        </Tooltip>
      ),
    },
    {
      title: '审批人',
      dataIndex: ['approver', 'name'],
      key: 'approver',
      width: 100,
      render: (_: any, record: LeaveRequest) => record.approver?.name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (val: string) => (
        <Tag color={STATUS_COLOR[val]}>{STATUS_LABEL[val] || val}</Tag>
      ),
    },
    {
      title: '申请时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (val: string) => val ? new Date(val).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_: any, record: LeaveRequest) => <Space size={0}>{getActions(record)}</Space>,
    },
  ];

  if (error && data.length === 0) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error}
        extra={<Button onClick={() => fetchData()}>重试</Button>}
      />
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          我的请假
        </h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/leave/new')}>
          新建请假
        </Button>
      </div>

      <Space style={{ marginBottom: 16 }}>
        <Select
          value={statusFilter}
          onChange={(val) => setStatusFilter(val)}
          options={STATUS_OPTIONS}
          style={{ width: 140 }}
        />
      </Space>

      {data.length === 0 && !loading ? (
        <Empty description="暂无请假记录" />
      ) : (
        <Table
          rowKey="id"
          columns={columns}
          dataSource={data}
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p) => fetchData(p),
            showTotal: (t) => `共 ${t} 条`,
            showSizeChanger: false,
          }}
          scroll={{ x: 1000 }}
        />
      )}
    </div>
  );
}
