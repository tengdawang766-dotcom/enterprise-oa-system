import { useState, useEffect, useCallback } from 'react';
import {
  Typography, Tabs, Table, Button, Space, Tag, Input, Select, Modal, Form,
  Switch, message, Spin, Drawer, Empty, Popconfirm,
} from 'antd';
import {
  EyeOutlined, StopOutlined, CheckOutlined, CloseOutlined,
  DeleteOutlined, PlusOutlined, EditOutlined,
} from '@ant-design/icons';
import {
  getAdminCategories, createAdminCategory, updateAdminCategory,
  getAdminArticles, getAdminArticle, takeDownArticle, approveReview, rejectReview,
  getAdminComments, adminDeleteComment,
} from '@/api/admin-knowledge';
import type { KnowledgeArticle, KnowledgeComment, AdminKnowledgeCategory } from '@/types';

const { Title, Text } = Typography;
const { TextArea } = Input;

// ========================
// Articles Tab
// ========================

function ArticlesTab() {
  const [articles, setArticles] = useState<KnowledgeArticle[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string[] | undefined>(undefined);
  const [categories, setCategories] = useState<AdminKnowledgeCategory[]>([]);

  // Detail drawer
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailArticle, setDetailArticle] = useState<KnowledgeArticle | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Take down modal
  const [takeDownOpen, setTakeDownOpen] = useState(false);
  const [takeDownReason, setTakeDownReason] = useState('');
  const [takeDownTarget, setTakeDownTarget] = useState<number | null>(null);
  const [takeDownLoading, setTakeDownLoading] = useState(false);

  // Reject modal
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<number | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getAdminCategories();
      setCategories(data);
    } catch {
      // Non-critical
    }
  }, []);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminArticles({
        page,
        pageSize,
        keyword: keyword || undefined,
        categoryId: categoryId || undefined,
        status: statusFilter && statusFilter.length > 0 ? statusFilter : undefined,
      });
      setArticles(data.items);
      setTotal(data.pagination.total);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword, categoryId, statusFilter]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleViewDetail = async (id: number) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const data = await getAdminArticle(id);
      setDetailArticle(data);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await approveReview(id);
      message.success('审核通过');
      fetchArticles();
      if (detailArticle?.id === id) {
        setDetailArticle((prev) => prev ? { ...prev, status: 'PUBLISHED' } : prev);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '操作失败');
    }
  };

  const handleOpenReject = (id: number) => {
    setRejectTarget(id);
    setRejectReason('');
    setRejectOpen(true);
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) {
      message.warning('请输入驳回原因');
      return;
    }
    setRejectLoading(true);
    try {
      await rejectReview(rejectTarget, rejectReason.trim());
      message.success('已驳回');
      setRejectOpen(false);
      fetchArticles();
      if (detailArticle?.id === rejectTarget) {
        setDetailArticle((prev) => prev ? { ...prev, status: 'TAKEN_DOWN' } : prev);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '操作失败');
    } finally {
      setRejectLoading(false);
    }
  };

  const handleOpenTakeDown = (id: number) => {
    setTakeDownTarget(id);
    setTakeDownReason('');
    setTakeDownOpen(true);
  };

  const handleTakeDown = async () => {
    if (!takeDownTarget || !takeDownReason.trim()) {
      message.warning('请输入下架原因');
      return;
    }
    setTakeDownLoading(true);
    try {
      await takeDownArticle(takeDownTarget, takeDownReason.trim());
      message.success('已下架');
      setTakeDownOpen(false);
      fetchArticles();
      if (detailArticle?.id === takeDownTarget) {
        setDetailArticle((prev) => prev ? { ...prev, status: 'TAKEN_DOWN' } : prev);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '操作失败');
    } finally {
      setTakeDownLoading(false);
    }
  };

  const statusTag = (status: string) => {
    switch (status) {
      case 'PUBLISHED': return <Tag color="green">已发布</Tag>;
      case 'DRAFT': return <Tag color="orange">草稿</Tag>;
      case 'WITHDRAWN': return <Tag color="red">已撤回</Tag>;
      case 'TAKEN_DOWN': return <Tag color="volcano">已下架</Tag>;
      case 'PENDING_REVIEW': return <Tag color="purple">审核中</Tag>;
      default: return <Tag>{status}</Tag>;
    }
  };

  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '作者',
      key: 'author',
      width: 100,
      render: (_: any, record: KnowledgeArticle) => record.author?.name || '-',
    },
    {
      title: '分类',
      key: 'category',
      width: 120,
      render: (_: any, record: KnowledgeArticle) => record.category?.name || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => statusTag(status),
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 170,
      render: (v: string | null) => v ? new Date(v).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: KnowledgeArticle) => (
        <Space size="small">
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record.id)}>
            查看
          </Button>
          {record.status === 'PENDING_REVIEW' && (
            <>
              <Button type="link" size="small" icon={<CheckOutlined />} onClick={() => handleApprove(record.id)}>
                通过
              </Button>
              <Button type="link" size="small" danger icon={<CloseOutlined />} onClick={() => handleOpenReject(record.id)}>
                驳回
              </Button>
            </>
          )}
          {record.status === 'PUBLISHED' && (
            <Button type="link" size="small" danger icon={<StopOutlined />} onClick={() => handleOpenTakeDown(record.id)}>
              下架
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }} wrap>
        <Input.Search
          placeholder="搜索标题"
          allowClear
          onSearch={(v) => { setKeyword(v); setPage(1); }}
          style={{ width: 200 }}
        />
        <Select
          placeholder="全部分类"
          allowClear
          style={{ width: 150 }}
          onChange={(v) => { setCategoryId(v); setPage(1); }}
          value={categoryId}
          options={categories.map((c) => ({ label: c.name, value: c.id }))}
        />
        <Select
          placeholder="全部状态"
          allowClear
          mode="multiple"
          style={{ width: 200 }}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          value={statusFilter}
          options={[
            { label: '草稿', value: 'DRAFT' },
            { label: '已发布', value: 'PUBLISHED' },
            { label: '已撤回', value: 'WITHDRAWN' },
            { label: '待审核', value: 'PENDING_REVIEW' },
            { label: '已下架', value: 'TAKEN_DOWN' },
          ]}
        />
      </Space>

      <Table
        dataSource={articles}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 篇`,
        }}
      />

      {/* Detail Drawer */}
      <Drawer
        title="文章详情"
        width={640}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : detailArticle ? (
          <div>
            <Title level={4}>{detailArticle.title}</Title>
            <Space style={{ marginBottom: 16 }} wrap>
              {detailArticle.category && <Tag color="blue">{detailArticle.category.name}</Tag>}
              {statusTag(detailArticle.status)}
              {detailArticle.author && <Text type="secondary">作者：{detailArticle.author.name}</Text>}
              {detailArticle.publishedAt && (
                <Text type="secondary">发布于：{new Date(detailArticle.publishedAt).toLocaleString('zh-CN')}</Text>
              )}
            </Space>
            {detailArticle.summary && (
              <div style={{ background: '#f5f5f5', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <Text type="secondary">{detailArticle.summary}</Text>
              </div>
            )}
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, marginBottom: 24 }}>
              {detailArticle.content}
            </div>
            {detailArticle.status === 'PENDING_REVIEW' && (
              <Space>
                <Button type="primary" icon={<CheckOutlined />} onClick={() => handleApprove(detailArticle.id)}>
                  审核通过
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={() => handleOpenReject(detailArticle.id)}>
                  驳回
                </Button>
              </Space>
            )}
            {detailArticle.status === 'PUBLISHED' && (
              <Button danger icon={<StopOutlined />} onClick={() => handleOpenTakeDown(detailArticle.id)}>
                下架
              </Button>
            )}
          </div>
        ) : (
          <Empty />
        )}
      </Drawer>

      {/* Take Down Modal */}
      <Modal
        title="下架文章"
        open={takeDownOpen}
        onCancel={() => setTakeDownOpen(false)}
        onOk={handleTakeDown}
        confirmLoading={takeDownLoading}
      >
        <TextArea
          rows={3}
          placeholder="请输入下架原因"
          value={takeDownReason}
          onChange={(e) => setTakeDownReason(e.target.value)}
        />
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="驳回文章"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        onOk={handleReject}
        confirmLoading={rejectLoading}
      >
        <TextArea
          rows={3}
          placeholder="请输入驳回原因"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}

// ========================
// Comments Tab
// ========================

function CommentsTab() {
  const [comments, setComments] = useState<KnowledgeComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [keyword, setKeyword] = useState('');

  // Delete modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminComments({
        page,
        pageSize,
        keyword: keyword || undefined,
      });
      setComments(data.items);
      setTotal(data.pagination.total);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, keyword]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleOpenDelete = (id: number) => {
    setDeleteTarget(id);
    setDeleteReason('');
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget || !deleteReason.trim()) {
      message.warning('请输入删除原因');
      return;
    }
    setDeleteLoading(true);
    try {
      await adminDeleteComment(deleteTarget, deleteReason.trim());
      message.success('评论已删除');
      setDeleteOpen(false);
      fetchComments();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '操作失败');
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns = [
    {
      title: '评论内容',
      key: 'content',
      ellipsis: true,
      render: (_: any, record: KnowledgeComment) => (
        record.isDeleted ? <Text type="secondary" italic>已删除</Text> : <Text>{record.content}</Text>
      ),
    },
    {
      title: '评论者',
      key: 'author',
      width: 100,
      render: (_: any, record: KnowledgeComment) => record.isDeleted ? '-' : record.author?.name,
    },
    {
      title: '评论时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '状态',
      key: 'status',
      width: 100,
      render: (_: any, record: KnowledgeComment) => {
        if (!record.isDeleted) return <Tag color="green">正常</Tag>;
        return <Tag color="red">已删除({record.deleteType === 'ADMIN' ? '管理员' : '用户'})</Tag>;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: any, record: KnowledgeComment) => (
        !record.isDeleted ? (
          <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleOpenDelete(record.id)}>
            删除
          </Button>
        ) : null
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="搜索评论内容"
          allowClear
          onSearch={(v) => { setKeyword(v); setPage(1); }}
          style={{ width: 250 }}
        />
      </Space>

      <Table
        dataSource={comments}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showTotal: (t) => `共 ${t} 条`,
        }}
      />

      <Modal
        title="删除评论"
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onOk={handleDelete}
        confirmLoading={deleteLoading}
      >
        <TextArea
          rows={3}
          placeholder="请输入删除原因"
          value={deleteReason}
          onChange={(e) => setDeleteReason(e.target.value)}
        />
      </Modal>
    </div>
  );
}

// ========================
// Categories Tab
// ========================

function CategoriesTab() {
  const [categories, setCategories] = useState<AdminKnowledgeCategory[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminKnowledgeCategory | null>(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminCategories();
      setCategories(data);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleAdd = () => {
    setEditingCategory(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (cat: AdminKnowledgeCategory) => {
    setEditingCategory(cat);
    form.setFieldsValue({
      name: cat.name,
      description: cat.description,
      sortOrder: cat.sortOrder,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingCategory) {
        await updateAdminCategory(editingCategory.id, values);
        message.success('更新成功');
      } else {
        await createAdminCategory(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchCategories();
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.error?.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (cat: AdminKnowledgeCategory) => {
    try {
      await updateAdminCategory(cat.id, { isActive: !cat.isActive });
      message.success(cat.isActive ? '已禁用' : '已启用');
      fetchCategories();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '操作失败');
    }
  };

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v: string | null) => v || '-',
    },
    {
      title: '排序',
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
    },
    {
      title: '状态',
      key: 'isActive',
      width: 100,
      render: (_: any, record: AdminKnowledgeCategory) => (
        <Switch
          checked={record.isActive}
          checkedChildren="启用"
          unCheckedChildren="禁用"
          onChange={() => handleToggleActive(record)}
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (v: string) => new Date(v).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: any, record: AdminKnowledgeCategory) => (
        <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
          编辑
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          新增分类
        </Button>
      </div>

      <Table
        dataSource={categories}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
      />

      <Modal
        title={editingCategory ? '编辑分类' : '新增分类'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="name"
            label="分类名称"
            rules={[
              { required: true, message: '请输入分类名称' },
              { max: 50, message: '名称最多50个字符' },
            ]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
            rules={[{ max: 200, message: '描述最多200个字符' }]}
          >
            <TextArea rows={2} placeholder="请输入描述（可选）" />
          </Form.Item>
          <Form.Item
            name="sortOrder"
            label="排序"
            initialValue={0}
          >
            <Input type="number" placeholder="排序值" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ========================
// Main Page
// ========================

export default function AdminKnowledgePage() {
  return (
    <div>
      <Title level={4} style={{ marginBottom: 24 }}>知识管理</Title>
      <Tabs
        items={[
          {
            key: 'articles',
            label: '文章管理',
            children: <ArticlesTab />,
          },
          {
            key: 'comments',
            label: '评论管理',
            children: <CommentsTab />,
          },
          {
            key: 'categories',
            label: '分类管理',
            children: <CategoriesTab />,
          },
        ]}
      />
    </div>
  );
}
