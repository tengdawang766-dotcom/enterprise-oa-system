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
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  SwapOutlined,
  KeyOutlined,
  StopOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import type { TablePaginationConfig } from 'antd/es/table';
import type { ColumnsType } from 'antd/es/table';
import type { User, Department } from '@/types';
import { getUsers, createUser, updateUser, transferDepartment, resetPassword, disableUser } from '@/api/users';
import { getDepartments } from '@/api/departments';

// helper: role label
const roleLabel: Record<string, string> = { ADMIN: '管理员', EMPLOYEE: '员工' };
const roleColor: Record<string, string> = { ADMIN: 'red', EMPLOYEE: 'blue' };
const statusLabel: Record<string, string> = { ENABLED: '启用', DISABLED: '停用' };
const statusColor: Record<string, string> = { ENABLED: 'green', DISABLED: 'default' };

export default function EmployeePage() {
  // ---- list state ----
  const [data, setData] = useState<User[]>([]);
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
  const [filterRole, setFilterRole] = useState<string | undefined>(undefined);
  const [filterStatus, setFilterStatus] = useState<string | undefined>(undefined);
  const [filterDept, setFilterDept] = useState<number | undefined>(undefined);

  // ---- department options (for filter & form) ----
  const [deptOptions, setDeptOptions] = useState<Department[]>([]);

  // ---- create modal ----
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm] = Form.useForm();
  const [createSaving, setCreateSaving] = useState(false);

  // ---- edit modal ----
  const [editOpen, setEditOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm] = Form.useForm();
  const [editSaving, setEditSaving] = useState(false);

  // ---- transfer modal ----
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferUser, setTransferUser] = useState<User | null>(null);
  const [transferForm] = Form.useForm();
  const [transferSaving, setTransferSaving] = useState(false);

  // ---- reset password modal ----
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetForm] = Form.useForm();
  const [resetSaving, setResetSaving] = useState(false);

  // ============================================================
  // fetch departments (for filters & forms)
  // ============================================================
  const fetchAllDepartments = useCallback(async () => {
    try {
      const res = await getDepartments({ pageSize: 1000 });
      setDeptOptions(res.items);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchAllDepartments();
  }, [fetchAllDepartments]);

  // ============================================================
  // fetch list
  // ============================================================
  const fetchList = useCallback(
    async (page = 1, pageSize = 10) => {
      setLoading(true);
      setError(null);
      try {
        const res = await getUsers({
          page,
          pageSize,
          keyword: keyword || undefined,
          role: filterRole,
          status: filterStatus,
          departmentId: filterDept,
        });
        setData(res.items);
        setPagination((prev) => ({
          ...prev,
          current: res.pagination.page,
          pageSize: res.pagination.pageSize,
          total: res.pagination.total,
        }));
      } catch (err: any) {
        const msg = err?.response?.data?.error?.message || '加载员工列表失败';
        setError(msg);
      } finally {
        setLoading(false);
      }
    },
    [keyword, filterRole, filterStatus, filterDept],
  );

  useEffect(() => {
    fetchList(1, pagination.pageSize as number);
  }, [fetchList]);

  // ============================================================
  // create employee
  // ============================================================
  const openCreateModal = () => {
    createForm.resetFields();
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setCreateSaving(true);
      await createUser({
        username: values.username,
        initialPassword: values.initialPassword,
        name: values.name,
        role: values.role,
        departmentId: values.departmentId ?? null,
        jobTitle: values.jobTitle || undefined,
        workEmail: values.workEmail || undefined,
        phone: values.phone || undefined,
      });
      message.success('员工已创建');
      setCreateOpen(false);
      fetchList(1, pagination.pageSize as number);
    } catch (err: any) {
      if (err?.errorFields) return;
      const msg = err?.response?.data?.error?.message || '创建失败';
      message.error(msg);
    } finally {
      setCreateSaving(false);
    }
  };

  // ============================================================
  // edit employee
  // ============================================================
  const openEditModal = (user: User) => {
    setEditUser(user);
    editForm.setFieldsValue({
      name: user.name,
      jobTitle: user.jobTitle ?? '',
      workEmail: user.workEmail ?? '',
      phone: user.phone ?? '',
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!editUser) return;
    try {
      const values = await editForm.validateFields();
      setEditSaving(true);
      await updateUser(editUser.id, {
        name: values.name,
        jobTitle: values.jobTitle || null,
        workEmail: values.workEmail || null,
        phone: values.phone || null,
      });
      message.success('员工资料已更新');
      setEditOpen(false);
      fetchList(pagination.current as number, pagination.pageSize as number);
    } catch (err: any) {
      if (err?.errorFields) return;
      const msg = err?.response?.data?.error?.message || '更新失败';
      message.error(msg);
    } finally {
      setEditSaving(false);
    }
  };

  // ============================================================
  // transfer department
  // ============================================================
  const openTransferModal = (user: User) => {
    setTransferUser(user);
    transferForm.resetFields();
    setTransferOpen(true);
  };

  const handleTransfer = async () => {
    if (!transferUser) return;
    try {
      const values = await transferForm.validateFields();
      setTransferSaving(true);
      await transferDepartment(transferUser.id, values.departmentId);
      message.success('部门调整成功');
      setTransferOpen(false);
      fetchList(pagination.current as number, pagination.pageSize as number);
    } catch (err: any) {
      if (err?.errorFields) return;
      const msg = err?.response?.data?.error?.message || '调整部门失败';
      message.error(msg);
    } finally {
      setTransferSaving(false);
    }
  };

  // ============================================================
  // reset password
  // ============================================================
  const openResetModal = (user: User) => {
    setResetUser(user);
    resetForm.resetFields();
    setResetOpen(true);
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    try {
      const values = await resetForm.validateFields();
      setResetSaving(true);
      const res = await resetPassword(resetUser.id, values.newPassword);
      message.success(res?.message || '密码已重置');
      setResetOpen(false);
    } catch (err: any) {
      if (err?.errorFields) return;
      const msg = err?.response?.data?.error?.message || '重置密码失败';
      message.error(msg);
    } finally {
      setResetSaving(false);
    }
  };

  // ============================================================
  // disable user
  // ============================================================
  const handleDisable = async (userId: number) => {
    try {
      const res = await disableUser(userId);
      message.success(res?.message || '账号已停用');
      fetchList(pagination.current as number, pagination.pageSize as number);
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '停用失败';
      message.error(msg);
    }
  };

  // ============================================================
  // columns
  // ============================================================
  const columns: ColumnsType<User> = [
    {
      title: '账号',
      dataIndex: 'username',
      key: 'username',
      width: 120,
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (val: string, record: User) => (
        <Space size={4}>
          {val}
          {record.isDepartmentManager && (
            <Tag color="orange" style={{ marginLeft: 4 }}>
              负责人
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '部门',
      key: 'department',
      width: 120,
      render: (_: unknown, record: User) =>
        record.department ? record.department.name : <Typography.Text type="secondary">-</Typography.Text>,
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      width: 90,
      render: (val: string) => <Tag color={roleColor[val]}>{roleLabel[val] ?? val}</Tag>,
    },
    {
      title: '职务',
      dataIndex: 'jobTitle',
      key: 'jobTitle',
      width: 120,
      render: (val: string | null) => val || '-',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      render: (val: string) => <Tag color={statusColor[val]}>{statusLabel[val] ?? val}</Tag>,
    },
    {
      title: '操作',
      key: 'action',
      width: 320,
      render: (_: unknown, record: User) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
            编辑
          </Button>
          <Button type="link" size="small" icon={<SwapOutlined />} onClick={() => openTransferModal(record)}>
            调部门
          </Button>
          <Button type="link" size="small" icon={<KeyOutlined />} onClick={() => openResetModal(record)}>
            重置密码
          </Button>
          {record.status === 'ENABLED' && (
            <Popconfirm
              title="确认停用"
              description={`确定要停用账号「${record.username}」吗？停用后该账号将无法登录。`}
              onConfirm={() => handleDisable(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button type="link" size="small" danger icon={<StopOutlined />}>
                停用
              </Button>
            </Popconfirm>
          )}
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
          员工管理
        </Typography.Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
          创建员工
        </Button>
      </div>

      {/* ---- filters ---- */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder="搜索账号/姓名"
          prefix={<SearchOutlined />}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onPressEnter={() => fetchList(1, pagination.pageSize as number)}
          allowClear
          style={{ width: 200 }}
        />
        <Select
          placeholder="角色筛选"
          allowClear
          value={filterRole}
          onChange={(val) => setFilterRole(val)}
          style={{ width: 120 }}
          options={[
            { label: '管理员', value: 'ADMIN' },
            { label: '员工', value: 'EMPLOYEE' },
          ]}
        />
        <Select
          placeholder="状态筛选"
          allowClear
          value={filterStatus}
          onChange={(val) => setFilterStatus(val)}
          style={{ width: 120 }}
          options={[
            { label: '启用', value: 'ENABLED' },
            { label: '停用', value: 'DISABLED' },
          ]}
        />
        <Select
          placeholder="部门筛选"
          allowClear
          showSearch
          optionFilterProp="label"
          value={filterDept}
          onChange={(val) => setFilterDept(val)}
          style={{ width: 160 }}
          options={deptOptions.map((d) => ({ label: d.name, value: d.id }))}
        />
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={data}
        loading={loading}
        pagination={pagination}
        onChange={handleTableChange}
        locale={{ emptyText: '暂无员工数据' }}
        scroll={{ x: 960 }}
      />

      {/* ---- create modal ---- */}
      <Modal
        title="创建员工"
        open={createOpen}
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={createSaving}
        destroyOnClose
        width={560}
      >
        <Form form={createForm} layout="vertical" preserve={false}>
          <Form.Item
            name="username"
            label="登录账号"
            rules={[{ required: true, message: '请输入登录账号' }]}
          >
            <Input placeholder="请输入登录账号" maxLength={50} />
          </Form.Item>
          <Form.Item
            name="initialPassword"
            label="初始密码"
            rules={[{ required: true, message: '请输入初始密码' }, { min: 6, message: '密码至少 6 位' }]}
          >
            <Input.Password placeholder="请输入初始密码（至少 6 位）" />
          </Form.Item>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" maxLength={50} />
          </Form.Item>
          <Form.Item
            name="role"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select
              placeholder="请选择角色"
              options={[
                { label: '管理员', value: 'ADMIN' },
                { label: '员工', value: 'EMPLOYEE' },
              ]}
            />
          </Form.Item>
          <Form.Item name="departmentId" label="部门">
            <Select
              placeholder="请选择部门（可留空）"
              allowClear
              showSearch
              optionFilterProp="label"
              options={deptOptions.map((d) => ({ label: d.name, value: d.id }))}
            />
          </Form.Item>
          <Form.Item name="jobTitle" label="职务">
            <Input placeholder="请输入职务" maxLength={50} />
          </Form.Item>
          <Form.Item
            name="workEmail"
            label="邮箱"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="请输入工作邮箱" />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input placeholder="请输入联系电话" maxLength={20} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- edit modal ---- */}
      <Modal
        title="编辑员工资料"
        open={editOpen}
        onOk={handleEdit}
        onCancel={() => setEditOpen(false)}
        confirmLoading={editSaving}
        destroyOnClose
      >
        {editUser && (
          <div style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary">
              账号：{editUser.username}　|　角色：{roleLabel[editUser.role]}
            </Typography.Text>
          </div>
        )}
        <Form form={editForm} layout="vertical" preserve={false}>
          <Form.Item
            name="name"
            label="姓名"
            rules={[{ required: true, message: '请输入姓名' }]}
          >
            <Input placeholder="请输入姓名" maxLength={50} />
          </Form.Item>
          <Form.Item name="jobTitle" label="职务">
            <Input placeholder="请输入职务" maxLength={50} />
          </Form.Item>
          <Form.Item
            name="workEmail"
            label="邮箱"
            rules={[{ type: 'email', message: '请输入有效的邮箱地址' }]}
          >
            <Input placeholder="请输入工作邮箱" />
          </Form.Item>
          <Form.Item name="phone" label="电话">
            <Input placeholder="请输入联系电话" maxLength={20} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- transfer department modal ---- */}
      <Modal
        title={`调整部门${transferUser ? ` - ${transferUser.name}` : ''}`}
        open={transferOpen}
        onOk={handleTransfer}
        onCancel={() => setTransferOpen(false)}
        confirmLoading={transferSaving}
        destroyOnClose
      >
        {transferUser && (
          <div style={{ marginBottom: 16 }}>
            <Typography.Text type="secondary">
              当前部门：{transferUser.department?.name ?? '无'}
            </Typography.Text>
          </div>
        )}
        <Form form={transferForm} layout="vertical" preserve={false}>
          <Form.Item
            name="departmentId"
            label="目标部门"
            rules={[{ required: true, message: '请选择目标部门' }]}
          >
            <Select
              placeholder="请选择目标部门"
              showSearch
              optionFilterProp="label"
              options={deptOptions.map((d) => ({ label: d.name, value: d.id }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ---- reset password modal ---- */}
      <Modal
        title={`重置密码${resetUser ? ` - ${resetUser.name}` : ''}`}
        open={resetOpen}
        onOk={handleResetPassword}
        onCancel={() => setResetOpen(false)}
        confirmLoading={resetSaving}
        destroyOnClose
      >
        <Form form={resetForm} layout="vertical" preserve={false}>
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }, { min: 6, message: '密码至少 6 位' }]}
          >
            <Input.Password placeholder="请输入新密码（至少 6 位）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
