import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Select, DatePicker, Input, Button, Card, Typography, message, Spin, Result } from 'antd';
import { ArrowLeftOutlined, SendOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { createLeave, editLeave, getMyLeaveDetail } from '@/api/leave';

const { Title } = Typography;
const { TextArea } = Input;

const LEAVE_TYPE_OPTIONS = [
  { value: 'PERSONAL', label: '事假' },
  { value: 'SICK', label: '病假' },
  { value: 'ANNUAL', label: '年假' },
];

export default function LeaveFormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const isEditMode = !!id;

  useEffect(() => {
    if (!id) return;

    const loadDetail = async () => {
      setFetching(true);
      setFetchError(null);
      try {
        const detail = await getMyLeaveDetail(Number(id));
        form.setFieldsValue({
          leaveType: detail.leaveType,
          startDate: detail.startDate ? dayjs(detail.startDate) : undefined,
          endDate: detail.endDate ? dayjs(detail.endDate) : undefined,
          reason: detail.reason,
        });
      } catch (err: any) {
        setFetchError(err?.response?.data?.error?.message || '加载请假详情失败');
      } finally {
        setFetching(false);
      }
    };

    loadDetail();
  }, [id, form]);

  const onFinish = async (values: any) => {
    const startDate = values.startDate.format('YYYY-MM-DD');
    const endDate = values.endDate.format('YYYY-MM-DD');

    setLoading(true);
    try {
      if (isEditMode) {
        await editLeave(Number(id), {
          leaveType: values.leaveType,
          startDate,
          endDate,
          reason: values.reason,
        });
        message.success('请假申请已更新');
      } else {
        await createLeave({
          leaveType: values.leaveType,
          startDate,
          endDate,
          reason: values.reason,
        });
        message.success('请假申请已提交');
      }
      navigate('/app/leave');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || '操作失败，请稍后重试';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (fetchError) {
    return (
      <Result
        status="error"
        title="加载失败"
        subTitle={fetchError}
        extra={
          <Button onClick={() => navigate('/app/leave')}>返回请假列表</Button>
        }
      />
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/app/leave')}
        style={{ marginBottom: 16 }}
      >
        返回请假列表
      </Button>

      <Card>
        <Title level={4} style={{ textAlign: 'center', marginBottom: 24 }}>
          {isEditMode ? '编辑请假申请' : '提交请假申请'}
        </Title>

        <Form
          form={form}
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
        >
          <Form.Item
            name="leaveType"
            label="请假类型"
            rules={[{ required: true, message: '请选择请假类型' }]}
          >
            <Select placeholder="请选择请假类型" options={LEAVE_TYPE_OPTIONS} />
          </Form.Item>

          <Form.Item
            name="startDate"
            label="开始日期"
            rules={[{ required: true, message: '请选择开始日期' }]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="请选择开始日期" />
          </Form.Item>

          <Form.Item
            name="endDate"
            label="结束日期"
            rules={[
              { required: true, message: '请选择结束日期' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const startDate = getFieldValue('startDate');
                  if (!value || !startDate || value.isSameOrAfter(startDate, 'day')) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('结束日期不能早于开始日期'));
                },
              }),
            ]}
          >
            <DatePicker style={{ width: '100%' }} placeholder="请选择结束日期" />
          </Form.Item>

          <Form.Item
            name="reason"
            label="请假事由"
            rules={[{ required: true, message: '请填写请假事由' }]}
          >
            <TextArea rows={4} placeholder="请填写请假事由" maxLength={500} showCount />
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', gap: 12 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SendOutlined />}
              >
                {isEditMode ? '保存修改' : '提交申请'}
              </Button>
              <Button onClick={() => navigate(-1)}>
                取消
              </Button>
            </div>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
