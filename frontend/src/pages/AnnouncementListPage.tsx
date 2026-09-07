import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { List, Input, Tag, Button, Result, Typography, Space, Empty, Radio } from 'antd';
import { SearchOutlined, MailOutlined } from '@ant-design/icons';
import type { EmployeeAnnouncementItem } from '@/types';
import { getMyAnnouncements } from '@/api/announcements';

const { Title, Text } = Typography;

export default function AnnouncementListPage() {
  const navigate = useNavigate();
  const [data, setData] = useState<EmployeeAnnouncementItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [readStatus, setReadStatus] = useState<string>('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 20;

  const fetchData = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getMyAnnouncements({
        page: p,
        pageSize,
        keyword: keyword || undefined,
        readStatus: readStatus || undefined,
      });
      setData(result.items);
      setTotal(result.pagination.total);
      setPage(result.pagination.page);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '加载公告列表失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, readStatus]);

  useEffect(() => {
    fetchData(1);
  }, [fetchData]);

  const unreadCount = data.filter((item) => !item.read).length;

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
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>
          <MailOutlined style={{ marginRight: 8 }} />
          公告列表
        </Title>
        {unreadCount > 0 && <Tag color="red">{unreadCount} 条未读</Tag>}
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Radio.Group
          value={readStatus}
          onChange={(e) => setReadStatus(e.target.value)}
          optionType="button"
          buttonStyle="solid"
        >
          <Radio.Button value="">全部</Radio.Button>
          <Radio.Button value="READ">已读</Radio.Button>
          <Radio.Button value="UNREAD">未读</Radio.Button>
        </Radio.Group>
        <Input
          placeholder="搜索公告标题"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => fetchData(1)}
          style={{ width: 200 }}
          allowClear
        />
        <Button icon={<SearchOutlined />} onClick={() => fetchData(1)}>
          搜索
        </Button>
      </Space>

      {data.length === 0 && !loading ? (
        <Empty description="暂无公告" />
      ) : (
        <List
          loading={loading}
          dataSource={data}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: (p) => fetchData(p),
            showTotal: (t) => `共 ${t} 条`,
          }}
          renderItem={(item) => (
            <List.Item
              style={{
                cursor: 'pointer',
                background: item.read ? '#fafafa' : '#fff',
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 8,
                border: item.read ? '1px solid #f0f0f0' : '1px solid #d9d9d9',
              }}
              onClick={() => navigate(`/app/announcements/${item.id}`)}
              actions={[
                item.read ? (
                  <Tag color="green">已读</Tag>
                ) : (
                  <Tag color="red">未读</Tag>
                ),
              ]}
            >
              <List.Item.Meta
                title={
                  <Space>
                    {!item.read && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff4d4f' }} />}
                    <Text strong={!item.read}>{item.title}</Text>
                  </Space>
                }
                description={
                  <Text type="secondary">
                    发布时间：{item.publishedAt ? new Date(item.publishedAt).toLocaleString('zh-CN') : '-'}
                  </Text>
                }
              />
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
