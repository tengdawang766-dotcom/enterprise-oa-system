import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Input, Select, List, Button, Space, Tag, Empty, Spin } from 'antd';
import { PlusOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import { getKnowledgeArticles, getKnowledgeCategories } from '@/api/knowledge';
import type { KnowledgeArticle, KnowledgeCategory } from '@/types';

const { Title } = Typography;
const { Search } = Input;

export default function KnowledgeListPage() {
  const navigate = useNavigate();
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getKnowledgeCategories();
      setCategories(data);
    } catch {
      // Categories load failure is non-critical
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getKnowledgeArticles({
        page,
        pageSize,
        keyword: keyword || undefined,
        categoryId: categoryId || undefined,
      });
      setArticles(data.items);
      setTotal(data.pagination.total);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, categoryId]);

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

  const statusTag = (status: string) => {
    if (status === 'PUBLISHED') return <Tag color="green">已发布</Tag>;
    if (status === 'DRAFT') return <Tag color="orange">草稿</Tag>;
    if (status === 'TAKEN_DOWN') return <Tag color="volcano">已下架</Tag>;
    if (status === 'PENDING_REVIEW') return <Tag color="purple">审核中</Tag>;
    return <Tag color="red">已撤回</Tag>;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>知识分享</Title>
        <Space>
          <Button onClick={() => navigate('/app/knowledge/mine')}>我的文章</Button>
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
                    <Button type="link" onClick={() => navigate(`/app/knowledge/articles/${item.id}`)}>
                      查看详情
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<FileTextOutlined style={{ fontSize: 24, marginTop: 4 }} />}
                    title={
                      <Space>
                        <span>{item.title}</span>
                        {item.category && <Tag>{item.category.name}</Tag>}
                      </Space>
                    }
                    description={
                      <Space>
                        {item.author && <span>作者：{item.author.name}</span>}
                        {item.publishedAt && <span>发布时间：{new Date(item.publishedAt).toLocaleString('zh-CN')}</span>}
                        {statusTag(item.status)}
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
