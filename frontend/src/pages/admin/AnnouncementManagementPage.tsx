import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Space,
  Tag,
  Popconfirm,
  message,
  Result,
  Typography,
  Tabs,
  Progress,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SendOutlined,
  RollbackOutlined,
  EyeOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { TablePaginationConfig } from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import type { AnnouncementListItem, ReadStats, ReadRecord, UnreadRecord } from '@/types';
import {
  getAnnouncements,
  getAnnouncement,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  withdrawAnnouncement,
  getReadStats,
  getReadList,
  getUnreadList,
} from '@/api/announcements';

import { ANNOUNCEMENT_STATUS_LABEL, ANNOUNCEMENT_STATUS_COLOR } from '@/utils/status-labels';
import { formatDateTime } from '@/utils/date-format';

const { TextArea } = Input;
const { Title } = Typography;

export default function AnnouncementManagementPage() {
  // ---- list state ----
  const [data, setData] = useState<AnnouncementListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
  });

  // ---- filters ----
  const [keyword, setKeyword] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);

  // ---- create modal ----
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [createSaving, setCreateSaving] = useState(false);

  // ---- edit modal ----
  const [editOpen, setEditOpen] = useState(false);
  const [editItem, setEditItem] = useState<AnnouncementListItem | null>(null);
  const [editForm] = Form.useForm();
  const [editSaving, setEditSaving] = useState(false);

  // ---- detail modal ----
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ---- read stats modal ----
  const [readStatsOpen, setReadStatsOpen] = useState(false);
  const [readStatsItem, setReadStatsItem] = useState<AnnouncementListItem | null>(null);
  const [readStats, setReadStats] = useState<ReadStats | null>(null);
  const [readList, setReadList] = useState<ReadRecord[]>([]);
  const [unreadList, setUnreadList] = useState<UnreadRecord[]>([]);
  const [readStatsLoading, setReadStatsLoading] = useState(false);

  // ========================
  // Data Loading
  // ========================

  const fetchData = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getAnnouncements({
        page,
        pageSize,
        status: filterStatus,
        keyword: keyword || undefined,
      });
      setData(result.items);
      setPagination((prev) => ({
        ...prev,
        current: result.pagination.page,
        pageSize: result.pagination.pageSize,
        total: result.pagination.total,
      }));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '加载公告列表失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, filterStatus]);

  useEffect(() => {
    fetchData(1, pagination.pageSize);
  }, [fetchData]);

  const handleTableChange = (pag: TablePaginationConfig) => {
    fetchData(pag.current ?? 1, pag.pageSize ?? 10);
  };

  // ========================
  // Create
  // ========================

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSaving(true);
      await createAnnouncement(values);
      message.success('公告草稿创建成功');
      setCreateOpen(false);
      createForm.resetFields();
      fetchData(pagination.current ?? 1, pagination.pageSize as number);
    } catch (err: any) {
      if (err?.errorFields) return; // form validation
      message.error(err?.response?.data?.error?.message || '创建失败');
    } finally {
      setCreateSaving(false);
    }
  };

  // ========================
  // Edit
  // ========================

  const openEdit = (item: AnnouncementListItem) => {
    setEditItem(item);
    editForm.setFieldsValue({ title: item.title, content: item.content });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    try {
      const values = await editForm.validateFields();
      if (!editItem) return;
      setEditSaving(true);
      await updateAnnouncement(editItem.id, values);
      message.success('公告修改成功');
      setEditOpen(false);
      editForm.resetFields();
      fetchData(pagination.current ?? 1, pagination.pageSize as number);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.error?.message || '修改失败');
    } finally {
      setEditSaving(false);
    }
  };

  // ========================
  // Delete
  // ========================

  const handleDelete = async (id: number) => {
    try {
      await deleteAnnouncement(id);
      message.success('公告已删除');
      fetchData(pagination.current ?? 1, pagination.pageSize as number);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '删除失败');
    }
  };

  // ========================
  // Publish
  // ========================

  const handlePublish = async (id: number) => {
    try {
      await publishAnnouncement(id);
      message.success('公告已发布');
      fetchData(pagination.current ?? 1, pagination.pageSize as number);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '发布失败');
    }
  };

  // ========================
  // Withdraw
  // ========================

  const handleWithdraw = async (id: number) => {
    try {
      await withdrawAnnouncement(id);
      message.success('公告已撤回');
      fetchData(pagination.current ?? 1, pagination.pageSize as number);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '撤回失败');
    }
  };

  // ========================
  // Detail
  // ========================

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const detail = await getAnnouncement(id);
      setDetailItem(detail);
    } catch (err: any) {
      message.error('加载公告详情失败');
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // ========================
  // Read Stats
  // ========================

  const openReadStats = async (item: AnnouncementListItem) => {
    setReadStatsItem(item);
    setReadStatsLoading(true);
    setReadStatsOpen(true);
    try {
      const [stats, reads, unreads] = await Promise.all([
        getReadStats(item.id),
        getReadList(item.id, { page: 1, pageSize: 100 }),
        getUnreadList(item.id, { page: 1, pageSize: 100 }),
      ]);
      setReadStats(stats);
      setReadList(reads.items);
      setUnreadList(unreads.items);
    } catch (err: any) {
      message.error('加载阅读统计失败');
    } finally {
      setReadStatsLoading(false);
    }
  };

  // ========================
  // Table Columns
  // ========================

  const columns: ColumnsType<AnnouncementListItem> = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      width: 300,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        const label = ANNOUNCEMENT_STATUS_LABEL[status] || status;
        const color = ANNOUNCEMENT_STATUS_COLOR[status] || 'default';
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: '发布时间',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      width: 180,
      render: (v: string | null) => formatDateTime(v),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (v: string) => formatDateTime(v),
    },
    {
      title: '操作',
      key: 'actions',
      width: 320,
      render: (_, record) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record.id)}>
            查看
          </Button>
          {record.status === 'DRAFT' && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(record)}>
                编辑
              </Button>
              <Popconfirm title="确认发布此公告？" onConfirm={() => handlePublish(record.id)}>
                <Button size="small" type="primary" icon={<SendOutlined />}>
                  发布
                </Button>
              </Popconfirm>
              <Popconfirm title="确认删除此草稿？" onConfirm={() => handleDelete(record.id)}>
                <Button size="small" danger icon={<DeleteOutlined />}>
                  删除
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'PUBLISHED' && (
            <>
              <Button size="small" icon={<EyeOutlined />} onClick={() => openReadStats(record)}>
                阅读情况
              </Button>
              <Popconfirm title="确认撤回此公告？" onConfirm={() => handleWithdraw(record.id)}>
                <Button size="small" danger icon={<RollbackOutlined />}>
                  撤回
                </Button>
              </Popconfirm>
            </>
          )}
          {record.status === 'WITHDRAWN' && (
            <Button size="small" icon={<EyeOutlined />} onClick={() => openReadStats(record)}>
              阅读情况
            </Button>
          )}
        </Space>
      ),
    },
  ];

  // ========================
  // Render
  // ========================

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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>公告管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
          新建公告
        </Button>
      </div>

      {/* Filters */}
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索标题"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => fetchData(1, pagination.pageSize as number)}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="状态筛选"
          value={filterStatus}
          onChange={setFilterStatus}
          allowClear
          style={{ width: 120 }}
          options={[
            { value: 'DRAFT', label: '草稿' },
            { value: 'PUBLISHED', label: '已发布' },
            { value: 'WITHDRAWN', label: '已撤回' },
          ]}
        />
        <Button icon={<SearchOutlined />} onClick={() => fetchData(1, pagination.pageSize as number)}>
          搜索
        </Button>
      </Space>

      {/* Table */}
      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
      />

      {/* Create Modal */}
      <Modal
        title="新建公告"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        confirmLoading={createSaving}
        okText="创建草稿"
        cancelText="取消"
        width={600}
      >
        <Form form={createForm} layout="vertical">
          <Form.Item name="title" label="公告标题" rules={[{ required: true, message: '请输入公告标题' }, { max: 200, message: '标题最多200字' }]}>
            <Input placeholder="请输入公告标题" />
          </Form.Item>
          <Form.Item name="content" label="公告内容" rules={[{ required: true, message: '请输入公告内容' }]}>
            <TextArea rows={8} placeholder="请输入公告内容" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        title="编辑公告"
        open={editOpen}
        onOk={handleEdit}
        onCancel={() => { setEditOpen(false); editForm.resetFields(); }}
        confirmLoading={editSaving}
        okText="保存"
        cancelText="取消"
        width={600}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="title" label="公告标题" rules={[{ required: true, message: '请输入公告标题' }, { max: 200, message: '标题最多200字' }]}>
            <Input placeholder="请输入公告标题" />
          </Form.Item>
          <Form.Item name="content" label="公告内容" rules={[{ required: true, message: '请输入公告内容' }]}>
            <TextArea rows={8} placeholder="请输入公告内容" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="公告详情"
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetailItem(null); }}
        footer={null}
        width={700}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : detailItem ? (
          <div>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="标题">{detailItem.title}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={ANNOUNCEMENT_STATUS_COLOR[detailItem.status] || 'default'}>
                  {ANNOUNCEMENT_STATUS_LABEL[detailItem.status] || detailItem.status}
                </Tag>
              </Descriptions.Item>
              {detailItem.publisher && (
                <Descriptions.Item label="发布人">{detailItem.publisher.name}</Descriptions.Item>
              )}
              <Descriptions.Item label="创建时间">
                {formatDateTime(detailItem.createdAt)}
              </Descriptions.Item>
              {detailItem.publishedAt && (
                <Descriptions.Item label="发布时间">
                  {formatDateTime(detailItem.publishedAt)}
                </Descriptions.Item>
              )}
              {detailItem.withdrawnAt && (
                <Descriptions.Item label="撤回时间">
                  {formatDateTime(detailItem.withdrawnAt)}
                </Descriptions.Item>
              )}
            </Descriptions>
            <div style={{ marginTop: 16 }}>
              <Title level={5}>公告内容</Title>
              <div style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
                {detailItem.content}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Read Stats Modal */}
      <Modal
        title={`阅读统计 - ${readStatsItem?.title || ''}`}
        open={readStatsOpen}
        onCancel={() => { setReadStatsOpen(false); setReadStatsItem(null); setReadStats(null); }}
        footer={null}
        width={700}
      >
        {readStatsLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : readStats ? (
          <div>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="应阅读人数">{readStats.totalEmployees}</Descriptions.Item>
              <Descriptions.Item label="已读人数">{readStats.readCount}</Descriptions.Item>
              <Descriptions.Item label="未读人数">{readStats.unreadCount}</Descriptions.Item>
              <Descriptions.Item label="阅读率">
                <Progress percent={readStats.readRate} size="small" style={{ width: 120 }} />
              </Descriptions.Item>
            </Descriptions>

            <Tabs
              items={[
                {
                  key: 'read',
                  label: `已读 (${readList.length})`,
                  children: (
                    <Table
                      rowKey="userId"
                      size="small"
                      pagination={false}
                      dataSource={readList}
                      columns={[
                        { title: '姓名', dataIndex: 'name', key: 'name' },
                        { title: '账号', dataIndex: 'username', key: 'username' },
                        { title: '部门', dataIndex: ['department', 'name'], key: 'department', render: (v: string) => v || '-' },
                        { title: '首次阅读时间', dataIndex: 'firstReadAt', key: 'firstReadAt', render: (v: string) => formatDateTime(v) },
                      ]}
                    />
                  ),
                },
                {
                  key: 'unread',
                  label: `未读 (${unreadList.length})`,
                  children: (
                    <Table
                      rowKey="userId"
                      size="small"
                      pagination={false}
                      dataSource={unreadList}
                      columns={[
                        { title: '姓名', dataIndex: 'name', key: 'name' },
                        { title: '账号', dataIndex: 'username', key: 'username' },
                        { title: '部门', dataIndex: ['department', 'name'], key: 'department', render: (v: string) => v || '-' },
                      ]}
                    />
                  ),
                },
              ]}
            />
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
