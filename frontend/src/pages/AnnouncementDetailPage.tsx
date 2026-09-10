import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Button, Result, Descriptions, Tag, Spin, Space } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { openAnnouncement } from '@/api/announcements';
import { formatDateTime } from '@/utils/date-format';

const { Title } = Typography;

export default function AnnouncementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await openAnnouncement(Number(id));
        setData(result);
      } catch (err: any) {
        setError(err?.response?.data?.error?.message || '加载公告详情失败');
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [id]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
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
          <Button onClick={() => navigate('/app/announcements')}>返回公告列表</Button>
        }
      />
    );
  }

  if (!data) {
    return (
      <Result
        status="404"
        title="公告不存在"
        extra={
          <Button onClick={() => navigate('/app/announcements')}>返回公告列表</Button>
        }
      />
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/app/announcements')}
        style={{ marginBottom: 16 }}
      >
        返回公告列表
      </Button>

      <div style={{ background: '#fff', padding: 24, borderRadius: 8, border: '1px solid #f0f0f0' }}>
        <Title level={3}>{data.title}</Title>

        <Descriptions column={1} size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="发布时间">
            {formatDateTime(data.publishedAt)}
          </Descriptions.Item>
          {data.read && (
            <Descriptions.Item label="阅读状态">
              <Space>
                <Tag color="green" icon={<CheckCircleOutlined />}>已读</Tag>
                {data.firstReadAt && (
                  <span style={{ color: '#999' }}>
                    首次阅读：{formatDateTime(data.firstReadAt)}
                  </span>
                )}
              </Space>
            </Descriptions.Item>
          )}
        </Descriptions>

        <div
          style={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.8,
            fontSize: 14,
            padding: 16,
            background: '#fafafa',
            borderRadius: 8,
            minHeight: 200,
          }}
        >
          {data.content}
        </div>
      </div>
    </div>
  );
}
