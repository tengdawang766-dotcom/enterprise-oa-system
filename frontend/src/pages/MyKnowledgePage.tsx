import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Input, Select, List, Button, Space, Tag, Empty, Spin, Modal, message } from 'antd';
import {
  PlusOutlined,
  FileTextOutlined,
  SearchOutlined,
  EditOutlined,
  SendOutlined,
  RollbackOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  getMyKnowledgeArticles,
  getKnowledgeCategories,
  publishKnowledgeArticle,
  withdrawKnowledgeArticle,
  submitReview,
} from '@/api/knowledge';
import type { KnowledgeArticle, KnowledgeCategory } from '@/types';

const { Title } = Typography;
const { Search } = Input;

export default function MyKnowledgePage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getKnowledgeCategories();
      setCategories(data);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyKnowledgeArticles({
        page,
        pageSize,
        keyword: keyword || undefined,
        categoryId: categoryId || undefined,
        status: status || undefined,
      });
      setArticles(data.items);
      setTotal(data.pagination.total);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, categoryId, status]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleSearch = (value: string) => {
    setKeyword(value);
    setPage(1);
  };

  const handleCategoryChange = (value: number | undefined) => {
    setCategoryId(value);
    setPage(1);
  };

  const handleStatusChange = (value: string | undefined) => {
    setStatus(value);
    setPage(1);
  };

  const handlePublish = (article: KnowledgeArticle) => {
    Modal.confirm({
      title: '确认发布',
      content: `确认发布「${article.title}」？发布后所有员工可见。`,
      onOk: async () => {
        try {
          await publishKnowledgeArticle(article.id);
          message.success('发布成功');
          fetchArticles();
        } catch (err: any) {
          message.error(err?.response?.data?.error?.message || '发布失败');
        }
      },
    });
  };

  const handleWithdraw = (article: KnowledgeArticle) => {
    Modal.confirm({
      title: '确认撤回',
      content: `确认撤回「${article.title}」？撤回后其他员工将无法查看。`,
      onOk: async () => {
        try {
          await withdrawKnowledgeArticle(article.id);
          message.success('撤回成功');
          fetchArticles();
        } catch (err: any) {
          message.error(err?.response?.data?.error?.message || '撤回失败');
        }
      },
    });
  };

  const handleSubmitReview = async (article: KnowledgeArticle) => {
    try {
      await submitReview(article.id);
      message.success('已提交审核');
      fetchArticles();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '提交审核失败');
    }
  };

  const statusTag = (s: string) => {
    if (s === 'PUBLISHED') return <Tag color="green">已发布</Tag>;
    if (s === 'DRAFT') return <Tag color="orange">草稿</Tag>;
    if (s === 'TAKEN_DOWN') return <Tag color="volcano">已下架</Tag>;
    if (s === 'PENDING_REVIEW') return <Tag color="purple">审核中</Tag>;
    return <Tag color="red">已撤回</Tag>;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>我的文章</Title>
        <Space>
          <Button onClick={() => navigate('/app/knowledge')}>返回列表</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/app/knowledge/editor')}>
            新建文章
          </Button>
        </Space>
      </div>

      <Space style={{ marginBottom: 16 }} wrap>
        <Search
          placeholder="搜索标题"
          allowClear
          onSearch={handleSearch}
          style={{ width: 250 }}
          enterButton={<SearchOutlined />}
        />
        <Select
          placeholder="全部分类"
          allowClear
          style={{ width: 150 }}
          onChange={handleCategoryChange}
          value={categoryId}
          options={categories.map((c) => ({ label: c.name, value: c.id }))}
        />
        <Select
          placeholder="全部状态"
          allowClear
          style={{ width: 120 }}
          onChange={handleStatusChange}
          value={status}
          options={[
            { label: '草稿', value: 'DRAFT' },
            { label: '已发布', value: 'PUBLISHED' },
            { label: '已撤回', value: 'WITHDRAWN' },
            { label: '待审核', value: 'PENDING_REVIEW' },
            { label: '已下架', value: 'TAKEN_DOWN' },
          ]}
        />
      </Space>

      {error && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#ff4d4f' }}>{error}</p>
          <Button onClick={fetchArticles}>重试</Button>
        </div>
      )}

      {!error && (
        <Spin spinning={loading}>
          {articles.length === 0 && !loading ? (
            <Empty description="暂无文章" />
          ) : (
            <List
              dataSource={articles}
              pagination={{
                current: page,
                pageSize,
                total,
                onChange: setPage,
                showTotal: (t) => `共 ${t} 篇`,
              }}
              renderItem={(item) => (
                <List.Item
                  actions={[
                    <Button key="view" type="link" onClick={() => navigate(`/app/knowledge/articles/${item.id}`)}>
                      查看
                    </Button>,
                    (item.status === 'DRAFT' || item.status === 'PUBLISHED' || item.status === 'TAKEN_DOWN') && (
                      <Button
                        key="edit"
                        type="link"
                        icon={<EditOutlined />}
                        onClick={() => navigate(`/app/knowledge/editor/${item.id}`)}
                      >
                        编辑
                      </Button>
                    ),
                    item.status === 'DRAFT' && (
                      <Button key="publish" type="link" icon={<SendOutlined />} onClick={() => handlePublish(item)}>
                        发布
                      </Button>
                    ),
                    item.status === 'PUBLISHED' && (
                      <Button key="withdraw" type="link" danger icon={<RollbackOutlined />} onClick={() => handleWithdraw(item)}>
                        撤回
                      </Button>
                    ),
                    item.status === 'TAKEN_DOWN' && (
                      <Button key="resubmit" type="link" icon={<ReloadOutlined />} onClick={() => handleSubmitReview(item)}>
                        重新提交审核
                      </Button>
                    ),
                  ].filter(Boolean)}
                >
                  <List.Item.Meta
                    avatar={<FileTextOutlined style={{ fontSize: 24, marginTop: 4 }} />}
                    title={
                      <Space>
                        <span>{item.title}</span>
                        {item.category && <Tag>{item.category.name}</Tag>}
                        {statusTag(item.status)}
                      </Space>
                    }
                    description={
                      <Space>
                        {item.publishedAt && <span>发布时间：{new Date(item.publishedAt).toLocaleString('zh-CN')}</span>}
                        <span>更新时间：{new Date(item.updatedAt).toLocaleString('zh-CN')}</span>
                      </Space>
                    }
                  />
                  {item.summary && <div style={{ color: '#666', marginTop: 4 }}>{item.summary}</div>}
                </List.Item>
              )}
            />
          )}
        </Spin>
      )}
    </div>
  );
}
