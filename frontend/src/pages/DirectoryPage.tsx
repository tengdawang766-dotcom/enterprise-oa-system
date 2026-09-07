import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Input,
  Select,
  Space,
  Button,
  Result,
  Typography,
  Modal,
  Descriptions,
} from 'antd';
import { SearchOutlined, UserOutlined, PhoneOutlined, MailOutlined } from '@ant-design/icons';
import type { TablePaginationConfig } from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import type { DirectoryItem, DirectoryDepartment } from '@/types';
import { getDirectory, getDirectoryDetail, getDirectoryDepartments } from '@/api/directory';

const { Title } = Typography;

export default function DirectoryPage() {
  const [data, setData] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 20,
    total: 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
  });

  // ---- filters ----
  const [keyword, setKeyword] = useState('');
  const [filterDept, setFilterDept] = useState<number | undefined>(undefined);
  const [departments, setDepartments] = useState<DirectoryDepartment[]>([]);

  // ---- detail modal ----
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<DirectoryItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // ========================
  // Load departments for filter
  // ========================

  useEffect(() => {
    const loadDepts = async () => {
      try {
        const depts = await getDirectoryDepartments();
        setDepartments(depts);
      } catch {
        // silently fail - filter just won't have options
      }
    };
    loadDepts();
  }, []);

  // ========================
  // Data Loading
  // ========================

  const fetchData = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    setError(null);
    try {
      const result = await getDirectory({
        page,
        pageSize,
        keyword: keyword || undefined,
        departmentId: filterDept,
      });
      setData(result.items);
      setPagination((prev) => ({
        ...prev,
        current: result.pagination.page,
        pageSize: result.pagination.pageSize,
        total: result.pagination.total,
      }));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '加载通讯录失败');
    } finally {
      setLoading(false);
    }
  }, [keyword, filterDept]);

  useEffect(() => {
    fetchData(1, pagination.pageSize);
  }, [fetchData]);

  const handleTableChange = (pag: TablePaginationConfig) => {
    fetchData(pag.current ?? 1, pag.pageSize ?? 20);
  };

  // ========================
  // Detail
  // ========================

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetailOpen(true);
    try {
      const detail = await getDirectoryDetail(id);
      setDetailItem(detail);
    } catch (err: any) {
      Modal.error({ title: '加载失败', content: err?.response?.data?.error?.message || '加载员工详情失败' });
      setDetailOpen(false);
    } finally {
      setDetailLoading(false);
    }
  };

  // ========================
  // Table Columns
  // ========================

  const columns: ColumnsType<DirectoryItem> = [
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 120,
    },
    {
      title: '账号',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '部门',
      dataIndex: ['department', 'name'],
      key: 'department',
      width: 120,
      render: (v: string) => v || '-',
    },
    {
      title: '职务',
      dataIndex: 'jobTitle',
      key: 'jobTitle',
      width: 150,
      render: (v: string) => v || '-',
    },
    {
      title: '工作邮箱',
      dataIndex: 'workEmail',
      key: 'workEmail',
      width: 200,
      render: (v: string) => v || '-',
    },
    {
      title: '联系电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 140,
      render: (v: string) => v || '-',
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_, record) => (
        <Button size="small" icon={<UserOutlined />} onClick={() => openDetail(record.id)}>
          详情
        </Button>
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
      <Title level={4} style={{ marginBottom: 16 }}>
        <PhoneOutlined style={{ marginRight: 8 }} />
        企业通讯录
      </Title>

      {/* Filters */}
      <Space style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索姓名或账号"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => fetchData(1, pagination.pageSize as number)}
          style={{ width: 200 }}
          allowClear
        />
        <Select
          placeholder="部门筛选"
          value={filterDept}
          onChange={setFilterDept}
          allowClear
          style={{ width: 150 }}
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
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

      {/* Detail Modal */}
      <Modal
        title="员工详情"
        open={detailOpen}
        onCancel={() => { setDetailOpen(false); setDetailItem(null); }}
        footer={null}
        width={500}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}>加载中...</div>
        ) : detailItem ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="姓名">{detailItem.name}</Descriptions.Item>
            <Descriptions.Item label="账号">{detailItem.username}</Descriptions.Item>
            <Descriptions.Item label="部门">{detailItem.department?.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="职务">{detailItem.jobTitle || '-'}</Descriptions.Item>
            <Descriptions.Item label="工作邮箱">
              {detailItem.workEmail ? (
                <Space><MailOutlined />{detailItem.workEmail}</Space>
              ) : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="联系电话">
              {detailItem.phone ? (
                <Space><PhoneOutlined />{detailItem.phone}</Space>
              ) : '-'}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Modal>
    </div>
  );
}
