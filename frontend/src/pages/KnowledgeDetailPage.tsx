import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Tag, Space, Button, Spin, message, Modal } from 'antd';
import { EditOutlined, SendOutlined, RollbackOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { getKnowledgeArticle, publishKnowledgeArticle, withdrawKnowledgeArticle } from '@/api/knowledge';
import { useAuthStore } from '@/stores/auth';
import type { KnowledgeArticle } from '@/types';

const { Title, Text } = Typography;

export default function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchArticle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getKnowledgeArticle(parseInt(id, 10));
      setArticle(data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  const isAuthor = article && user && article.authorId === user.id;

  const handlePublish = () => {
    if (!article) return;
    Modal.confirm({
      title: '确认发布',
      content: '发布后所有员工可见，确认发布？',
      onOk: async () => {
        try {
          await publishKnowledgeArticle(article.id);
          message.success('发布成功');
          fetchArticle();
        } catch (err: any) {
          message.error(err?.response?.data?.error?.message || '发布失败');
        }
      },
    });
  };

  const handleWithdraw = () => {
    if (!article) return;
    Modal.confirm({
      title: '确认撤回',
      content: '撤回后其他员工将无法查看此文章，确认撤回？',
      onOk: async () => {
        try {
          await withdrawKnowledgeArticle(article.id);
          message.success('撤回成功');
          fetchArticle();
        } catch (err: any) {
          message.error(err?.response?.data?.error?.message || '撤回失败');
        }
      },
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <p style={{ color: '#ff4d4f', marginBottom: 16 }}>{error || '文章不存在'}</p>
        <Button onClick={() => navigate('/app/knowledge')}>返回列表</Button>
      </div>
    );
  }

  const statusTag = () => {
    if (article.status === 'PUBLISHED') return <Tag color="green">已发布</Tag>;
    if (article.status === 'DRAFT') return <Tag color="orange">草稿</Tag>;
    return <Tag color="red">已撤回</Tag>;
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate(-1)}
        style={{ marginBottom: 16, padding: 0 }}
      >
        返回
      </Button>

      <Title level={3}>{article.title}</Title>

      <Space style={{ marginBottom: 24 }} wrap>
        {article.category && <Tag color="blue">{article.category.name}</Tag>}
        {statusTag()}
        {article.author && <Text type="secondary">作者：{article.author.name}</Text>}
        {article.publishedAt && (
          <Text type="secondary">发布时间：{new Date(article.publishedAt).toLocaleString('zh-CN')}</Text>
        )}
        {article.updatedAt && (
          <Text type="secondary">更新时间：{new Date(article.updatedAt).toLocaleString('zh-CN')}</Text>
        )}
      </Space>

      {isAuthor && (
        <Space style={{ marginBottom: 24 }}>
          {(article.status === 'DRAFT' || article.status === 'PUBLISHED') && (
            <Button icon={<EditOutlined />} onClick={() => navigate(`/app/knowledge/editor/${article.id}`)}>
              编辑
            </Button>
          )}
          {article.status === 'DRAFT' && (
            <Button type="primary" icon={<SendOutlined />} onClick={handlePublish}>
              发布
            </Button>
          )}
          {article.status === 'PUBLISHED' && (
            <Button danger icon={<RollbackOutlined />} onClick={handleWithdraw}>
              撤回
            </Button>
          )}
        </Space>
      )}

      {article.summary && (
        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <Text type="secondary">{article.summary}</Text>
        </div>
      )}

      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 15 }}>
        {article.content}
      </div>
    </div>
  );
}
