import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Descriptions, Tag, Button, Timeline, Spin, Result, Card, Empty, Space } from 'antd';
import { ArrowLeftOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { LeaveDetail, LeaveActionLog } from '@/types';
import { getMyLeaveDetail, getApprovalDetail } from '@/api/leave';

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

const ACTION_LABEL: Record<string, string> = {
  SUBMITTED: '提交',
  APPROVED: '通过',
  REJECTED: '驳回',
  CANCELLED: '撤回',
  EDITED: '修改',
  RESUBMITTED: '重新提交',
};

const ACTION_COLOR: Record<string, string> = {
  SUBMITTED: 'blue',
  APPROVED: 'green',
  REJECTED: 'red',
  CANCELLED: 'gray',
  EDITED: 'orange',
  RESUBMITTED: 'blue',
};

function TimelineItemContent({ log }: { log: LeaveActionLog }) {
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <Tag color={ACTION_COLOR[log.action] || 'default'}>
          {ACTION_LABEL[log.action] || log.action}
        </Tag>
        <span style={{ fontWeight: 500 }}>{log.operatorName}</span>
        <span style={{ color: '#999', marginLeft: 8 }}>
          {new Date(log.createdAt).toLocaleString('zh-CN')}
        </span>
      </div>
      {log.comment && (
        <div style={{ color: '#666', fontSize: 13 }}>{log.comment}</div>
      )}
    </div>
  );
}

export default function LeaveDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<LeaveDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine if this is an approval view based on URL
  const isApprovalView = location.pathname.startsWith('/app/approvals');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const fetchFn = isApprovalView ? getApprovalDetail : getMyLeaveDetail;
    fetchFn(Number(id))
      .then((res) => {
        setData(res);
      })
      .catch((err: any) => {
        setError(err?.response?.data?.error?.message || '加载请假详情失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id, isApprovalView]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (error) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error}
        extra={
          <Space>
            <Button onClick={() => navigate(-1)}>返回</Button>
            <Button type="primary" onClick={() => window.location.reload()}>重试</Button>
          </Space>
        }
      />
    );
  }

  if (!data) {
    return (
      <Result
        status="404"
        title="未找到"
        subTitle="该请假记录不存在"
        extra={<Button onClick={() => navigate('/app/leave')}>返回列表</Button>}
      />
    );
  }

  const actionLogs = data.actionLogs || [];

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>

      <Card title="请假详情" style={{ marginBottom: 24 }}>
        <Descriptions column={2} bordered size="middle">
          <Descriptions.Item label="请假类型">
            {LEAVE_TYPE_LABEL[data.leaveType] || data.leaveType}
          </Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={STATUS_COLOR[data.status]}>{STATUS_LABEL[data.status] || data.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="开始日期">
            {data.startDate?.slice(0, 10)}
          </Descriptions.Item>
          <Descriptions.Item label="结束日期">
            {data.endDate?.slice(0, 10)}
          </Descriptions.Item>
          <Descriptions.Item label="请假天数">{data.days} 天</Descriptions.Item>
          <Descriptions.Item label="审批人">
            {data.approver?.name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="事由" span={2}>
            {data.reason}
          </Descriptions.Item>
          <Descriptions.Item label="申请时间" span={2}>
            {data.createdAt ? new Date(data.createdAt).toLocaleString('zh-CN') : '-'}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="审批记录">
        {actionLogs.length === 0 ? (
          <Empty description="暂无审批记录" />
        ) : (
          <Timeline
            items={actionLogs.map((log) => ({
              color: ACTION_COLOR[log.action] || 'gray',
              dot: <ClockCircleOutlined style={{ fontSize: 14 }} />,
              children: <TimelineItemContent log={log} />,
            }))}
          />
        )}
      </Card>
    </div>
  );
}
