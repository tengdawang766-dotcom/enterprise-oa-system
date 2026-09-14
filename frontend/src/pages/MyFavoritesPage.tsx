import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, List, Button, Space, Tag, Empty, Spin, Card, message, Popconfirm } from 'antd';
import { StarFilled, DeleteOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { getMyFavorites, unfavoriteArticle } from '@/api/knowledge';
import type { KnowledgeFavoriteItem } from '@/types';

const { Title, Text } = Typography;

export default function MyFavoritesPage() {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<KnowledgeFavoriteItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchFavorites = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyFavorites(page, pageSize);
      setFavorites(data.items);
      setTotal(data.pagination.total);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    fetchFavorites();
  }, [fetchFavorites]);

  const handleRemoveFavorite = async (favoriteId: number) => {
    try {
      // We need articleId to call unfavorite, but favorites have favoriteId
      // Try to find the item to get articleId
      const item = favorites.find((f) => f.favoriteId === favoriteId);
      if (item?.articleId) {
        await unfavoriteArticle(item.articleId);
      }
      message.success('已取消收藏');
      fetchFavorites();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '操作失败');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Space>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/app/knowledge')}
            style={{ padding: 0 }}
          >
            返回
          </Button>
          <Title level={4} style={{ margin: 0 }}>我的收藏</Title>
        </Space>
      </div>

      <Spin spinning={loading}>
        {favorites.length === 0 && !loading ? (
          <Empty description="暂无收藏" />
        ) : (
          <List
            dataSource={favorites}
            pagination={{
              current: page,
              pageSize,
              total,
              onChange: setPage,
              showTotal: (t) => `共 ${t} 条`,
            }}
            renderItem={(item) => (
              <Card
                style={{ marginBottom: 12 }}
                size="small"
                hoverable={item.available}
                onClick={item.available && item.articleId ? () => navigate(`/app/knowledge/articles/${item.articleId}`) : undefined}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    {item.available ? (
                      <>
                        <Space style={{ marginBottom: 8 }}>
                          <StarFilled style={{ color: '#faad14' }} />
                          <Text strong>{item.title}</Text>
                          {item.category && <Tag color="blue">{item.category.name}</Tag>}
                        </Space>
                        {item.summary && (
                          <div style={{ color: '#666', marginBottom: 4 }}>{item.summary}</div>
                        )}
                        <Space>
                          {item.author && <Text type="secondary">作者：{item.author.name}</Text>}
                          <Text type="secondary">收藏时间：{new Date(item.favoritedAt).toLocaleString('zh-CN')}</Text>
                        </Space>
                      </>
                    ) : (
                      <>
                        <Space style={{ marginBottom: 8 }}>
                          <StarFilled style={{ color: '#d9d9d9' }} />
                          <Text type="secondary" delete>文章已不可用</Text>
                        </Space>
                        <div>
                          <Text type="secondary">收藏时间：{new Date(item.favoritedAt).toLocaleString('zh-CN')}</Text>
                          {item.reason && <Text type="secondary" style={{ marginLeft: 8 }}>({item.reason})</Text>}
                        </div>
                      </>
                    )}
                  </div>
                  <Popconfirm
                    title="确认取消收藏？"
                    onConfirm={(e) => {
                      e?.stopPropagation();
                      handleRemoveFavorite(item.favoriteId);
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                  >
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                </div>
              </Card>
            )}
          />
        )}
      </Spin>
    </div>
  );
}
