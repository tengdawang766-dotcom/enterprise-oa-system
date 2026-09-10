import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Descriptions, Tag, Button, Timeline, Spin, Result, Card, Empty, Space } from 'antd';
import { ArrowLeftOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { LeaveDetail, LeaveActionLog } from '@/types';
import { getMyLeaveDetail, getApprovalDetail } from '@/api/leave';
import {
  LEAVE_STATUS_LABEL,
  LEAVE_STATUS_COLOR,
  LEAVE_TYPE_LABEL,
  LEAVE_ACTION_LABEL,
  LEAVE_ACTION_COLOR,
} from '@/utils/status-labels';

import { formatDate, formatDateTime } from '@/utils/date-format';

function TimelineItemContent({ log }: { log: LeaveActionLog }) {
  return (
    <div>
      <div style={{ marginBottom: 4 }}>
        <Tag color={LEAVE_ACTION_COLOR[log.action] || 'default'}>
          {LEAVE_ACTION_LABEL[log.action] || log.action}
        </Tag>
        <span style={{ fontWeight: 500 }}>{log.operatorName}</span>
        <span style={{ color: '#999', marginLeft: 8 }}>
          {formatDateTime(log.createdAt)}
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
            <Button type="primary" onClick={() => { setLoading(true); setError(null); const fetchFn = isApprovalView ? getApprovalDetail : getMyLeaveDetail; fetchFn(Number(id)).then(setData).catch((e: any) => setError(e?.response?.data?.error?.message || '加载请假详情失败')).finally(() => setLoading(false)); }}>重试</Button>
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
            <Tag color={LEAVE_STATUS_COLOR[data.status]}>{LEAVE_STATUS_LABEL[data.status] || data.status}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="开始日期">
            {formatDate(data.startDate)}
          </Descriptions.Item>
          <Descriptions.Item label="结束日期">
            {formatDate(data.endDate)}
          </Descriptions.Item>
          <Descriptions.Item label="请假天数">{data.days} 天</Descriptions.Item>
          <Descriptions.Item label="审批人">
            {data.approver?.name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="事由" span={2}>
            {data.reason}
          </Descriptions.Item>
          <Descriptions.Item label="申请时间" span={2}>
            {formatDateTime(data.createdAt)}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="审批记录">
        {actionLogs.length === 0 ? (
          <Empty description="暂无审批记录" />
        ) : (
          <Timeline
            items={actionLogs.map((log) => ({
              color: LEAVE_ACTION_COLOR[log.action] || 'gray',
              dot: <ClockCircleOutlined style={{ fontSize: 14 }} />,
              children: <TimelineItemContent log={log} />,
            }))}
          />
        )}
      </Card>
    </div>
  );
}
