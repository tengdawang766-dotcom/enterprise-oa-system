import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Tag,
  Popconfirm,
  message,
  Result,
  Typography,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserSwitchOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { TablePaginationConfig } from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import type { Department, ManagerCandidate } from '@/types';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  getManagerCandidates,
  setManager,
  removeManager,
} from '@/api/departments';

export default function DepartmentPage() {
  // ---- list state ----
  const [data, setData] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showTotal: (total) => `共 ${total} 条`,
  });

  // ---- name modal ----
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [nameForm] = Form.useForm();
  const [nameSaving, setNameSaving] = useState(false);

  // ---- manager modal ----
  const [managerModalOpen, setManagerModalOpen] = useState(false);
  const [managerDept, setManagerDept] = useState<Department | null>(null);
  const [candidates, setCandidates] = useState<ManagerCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateKeyword, setCandidateKeyword] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [managerSaving, setManagerSaving] = useState(false);

  // ============================================================
  // fetch list
  // ============================================================
  const fetchList = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getDepartments({ page, pageSize });
      setData(res.items);
      setPagination((prev) => ({
        ...prev,
        current: res.pagination.page,
        pageSize: res.pagination.pageSize,
        total: res.pagination.total,
      }));
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '加载部门列表失败';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchList(pagination.current as number, pagination.pageSize as number);
  }, [fetchList]);

  // ============================================================
  // create / edit name
  // ============================================================
  const openCreateModal = () => {
    setEditingDept(null);
    setNameModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setNameModalOpen(true);
  };

  // Set form values after modal opens (form is now mounted)
  useEffect(() => {
    if (nameModalOpen) {
      if (editingDept) {
        nameForm.setFieldsValue({ name: editingDept.name });
      } else {
        nameForm.resetFields();
      }
    }
  }, [nameModalOpen, editingDept, nameForm]);

  const handleNameSubmit = async () => {
    try {
      const values = await nameForm.validateFields();
      setNameSaving(true);
      if (editingDept) {
        await updateDepartment(editingDept.id, values.name);
        message.success('部门名称已更新');
      } else {
        await createDepartment(values.name);
        message.success('部门已创建');
      }
      setNameModalOpen(false);
      fetchList(pagination.current as number, pagination.pageSize as number);
    } catch (err: any) {
      if (err?.errorFields) return; // form validation
      const msg = err?.response?.data?.error?.message || '操作失败';
      message.error(msg);
    } finally {
      setNameSaving(false);
    }
  };

  // ============================================================
  // delete
  // ============================================================
  const handleDelete = async (id: number) => {
    try {
      await deleteDepartment(id);
      message.success('部门已删除');
      fetchList(pagination.current as number, pagination.pageSize as number);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '删除失败';
      message.error(msg);
    }
  };

  // ============================================================
  // manager
  // ============================================================
  const openManagerModal = async (dept: Department) => {
    setManagerDept(dept);
    setSelectedCandidate(null);
    setCandidateKeyword('');
    setManagerModalOpen(true);
    await fetchCandidates(dept.id, '');
  };

  const fetchCandidates = async (deptId: number, keyword: string) => {
    setCandidatesLoading(true);
    try {
      const res = await getManagerCandidates(deptId, { keyword, pageSize: 100 });
      setCandidates(res.items);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '加载候选人失败';
      message.error(msg);
    } finally {
      setCandidatesLoading(false);
    }
  };

  const handleCandidateSearch = (value: string) => {
    setCandidateKeyword(value);
    if (managerDept) {
      fetchCandidates(managerDept.id, value);
    }
  };

  const handleSetManager = async () => {
    if (!managerDept || !selectedCandidate) return;
    setManagerSaving(true);
    try {
      await setManager(managerDept.id, selectedCandidate);
      message.success('负责人已设置');
      setManagerModalOpen(false);
      fetchList(pagination.current as number, pagination.pageSize as number);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '设置负责人失败';
      message.error(msg);
    } finally {
      setManagerSaving(false);
    }
  };

  const handleRemoveManager = async () => {
    if (!managerDept) return;
    setManagerSaving(true);
    try {
      await removeManager(managerDept.id);
      message.success('负责人已卸任');
      setManagerModalOpen(false);
      fetchList(pagination.current as number, pagination.pageSize as number);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '卸任失败';
      message.error(msg);
    } finally {
      setManagerSaving(false);
    }
  };

  // ============================================================
  // columns
  // ============================================================
  const columns: ColumnsType<Department> = [
    {
      title: '部门名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '负责人',
      key: 'manager',
      render: (_: unknown, record: Department) =>
        record.manager ? record.manager.name : <Typography.Text type="secondary">未设置</Typography.Text>,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 200,
      render: (val: string) => new Date(val).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      width: 300,
      render: (_: unknown, record: Department) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEditModal(record)}
          >
            编辑
          </Button>
          <Button
            type="link"
            size="small"
            icon={<UserSwitchOutlined />}
            onClick={() => openManagerModal(record)}
          >
            管理负责人
          </Button>
          <Popconfirm
            title="确认删除"
            description="删除后不可恢复，确定要删除该部门吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ============================================================
  // table pagination change
  // ============================================================
  const handleTableChange = (pag: TablePaginationConfig) => {
    fetchList(pag.current as number, pag.pageSize as number);
  };

  // ============================================================
  // render
  // ============================================================
  if (error && data.length === 0) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={error}
        extra={
          <Button type="primary" onClick={() => fetchList(1, pagination.pageSize as number)}>
            重试
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          部门管理
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          新增部门
        </Button>
      </div>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        locale={{ emptyText: '暂无部门数据' }}
      />

      {/* ---- name modal ---- */}
      <Modal
        title={editingDept ? '修改部门名称' : '新增部门'}
        open={nameModalOpen}
        onOk={handleNameSubmit}
        onCancel={() => setNameModalOpen(false)}
        confirmLoading={nameSaving}
        destroyOnHidden
      >
        <Form form={nameForm} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="部门名称"
            rules={[{ required: true, message: '请输入部门名称' }]}
          >
            <Input placeholder="请输入部门名称" maxLength={50} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- manager modal ---- */}
      <Modal
        title={`管理负责人${managerDept ? ` - ${managerDept.name}` : ''}`}
        open={managerModalOpen}
        onCancel={() => setManagerModalOpen(false)}
        footer={null}
        destroyOnHidden
        width={560}
      >
        {managerDept && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Typography.Text strong>当前负责人：</Typography.Text>
              {managerDept.manager ? (
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {managerDept.manager.name}
                </Tag>
              ) : (
                <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                  未设置
                </Typography.Text>
              )}
            </div>

            <Typography.Text strong>选择新负责人</Typography.Text>
            <Input
              placeholder="搜索候选人（姓名）"
              prefix={<SearchOutlined />}
              value={candidateKeyword}
              onChange={(e) => handleCandidateSearch(e.target.value)}
              allowClear
              style={{ margin: '8px 0' }}
            />

            <Table
              rowKey="id"
              size="small"
              loading={candidatesLoading}
              dataSource={candidates}
              pagination={false}
              scroll={{ y: 240 }}
              columns={[
                {
                  title: '姓名',
                  dataIndex: 'name',
                  key: 'name',
                },
                {
                  title: '职务',
                  dataIndex: 'jobTitle',
                  key: 'jobTitle',
                  render: (val: string | null) => val || '-',
                },
                {
                  title: '选择',
                  key: 'select',
                  width: 80,
                  render: (_: unknown, record: ManagerCandidate) => (
                    <Button
                      type={selectedCandidate === record.id ? 'primary' : 'default'}
                      size="small"
                      onClick={() => setSelectedCandidate(record.id)}
                    >
                      {selectedCandidate === record.id ? '已选' : '选择'}
                    </Button>
                  ),
                },
              ]}
              locale={{ emptyText: '暂无候选人' }}
            />

            <Space style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
              {managerDept.manager && (
                <Popconfirm
                  title="确认卸任该部门负责人？"
                  onConfirm={handleRemoveManager}
                  okText="确定"
                  cancelText="取消"
                >
                  <Button danger loading={managerSaving}>
                    卸任负责人
                  </Button>
                </Popconfirm>
              )}
              <Button
                type="primary"
                disabled={!selectedCandidate}
                loading={managerSaving}
                onClick={handleSetManager}
              >
                {managerDept.manager ? '更换负责人' : '任命负责人'}
              </Button>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  );
}
