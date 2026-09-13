import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Typography, Form, Input, Select, Button, Space, Spin, message } from 'antd';
import { SaveOutlined, SendOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import {
  getKnowledgeArticle,
  getKnowledgeCategories,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  publishKnowledgeArticle,
} from '@/api/knowledge';
import type { KnowledgeCategory } from '@/types';

const { Title } = Typography;
const { TextArea } = Input;

interface FormValues {
  title: string;
  summary?: string;
  content: string;
  categoryId: number;
}

export default function KnowledgeEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm<FormValues>();
  const [categories, setCategories] = useState<KnowledgeCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(!!id);

  const isEdit = !!id;

  const fetchCategories = useCallback(async () => {
    try {
      const data = await getKnowledgeCategories();
      setCategories(data);
    } catch {
      message.error('加载分类失败');
    }
  }, []);

  const fetchArticle = useCallback(async () => {
    if (!id) return;
    setInitialLoading(true);
    try {
      const data = await getKnowledgeArticle(parseInt(id, 10));
      form.setFieldsValue({
        title: data.title,
        summary: data.summary || undefined,
        content: data.content,
        categoryId: data.categoryId,
      });
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '加载文章失败');
      navigate('/app/knowledge/mine');
    } finally {
      setInitialLoading(false);
    }
  }, [id, form, navigate]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (isEdit) {
      fetchArticle();
    }
  }, [isEdit, fetchArticle]);

  const handleSaveDraft = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (isEdit) {
        await updateKnowledgeArticle(parseInt(id!, 10), values);
        message.success('保存成功');
        navigate(`/app/knowledge/articles/${id}`);
      } else {
        const result = await createKnowledgeArticle(values);
        message.success('草稿创建成功');
        navigate(`/app/knowledge/articles/${result.id}`);
      }
    } catch (err: any) {
      if (err?.errorFields) return; // form validation error
      message.error(err?.response?.data?.error?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      let articleId: number;
      if (isEdit) {
        await updateKnowledgeArticle(parseInt(id!, 10), values);
        articleId = parseInt(id!, 10);
      } else {
        const result = await createKnowledgeArticle(values);
        articleId = result.id;
      }
      await publishKnowledgeArticle(articleId);
      message.success('发布成功');
      navigate(`/app/knowledge/articles/${articleId}`);
    } catch (err: any) {
      if (err?.errorFields) return;
      message.error(err?.response?.data?.error?.message || '发布失败');
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

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

      <Title level={4}>{isEdit ? '编辑文章' : '新建文章'}</Title>

      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
      >
        <Form.Item
          name="title"
          label="标题"
          rules={[
            { required: true, message: '请输入标题' },
            { min: 2, message: '标题至少2个字符' },
            { max: 200, message: '标题最多200个字符' },
          ]}
        >
          <Input placeholder="请输入文章标题" maxLength={200} showCount />
        </Form.Item>

        <Form.Item
          name="categoryId"
          label="分类"
          rules={[{ required: true, message: '请选择分类' }]}
        >
          <Select
            placeholder="请选择分类"
            loading={categories.length === 0}
            options={categories.map((c) => ({ label: c.name, value: c.id }))}
          />
        </Form.Item>

        <Form.Item
          name="summary"
          label="摘要"
          rules={[{ max: 500, message: '摘要最多500个字符' }]}
        >
          <TextArea placeholder="请输入摘要（可选）" maxLength={500} showCount rows={2} />
        </Form.Item>

        <Form.Item
          name="content"
          label="正文"
          rules={[
            { required: true, message: '请输入正文' },
            { min: 1, message: '正文不能为空' },
            { max: 60000, message: '正文最多60000个字符' },
          ]}
        >
          <TextArea
            placeholder="请输入文章正文"
            maxLength={60000}
            rows={15}
            style={{ fontFamily: 'monospace' }}
          />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button
              icon={<SaveOutlined />}
              onClick={handleSaveDraft}
              loading={saving}
            >
              {isEdit ? '保存修改' : '保存草稿'}
            </Button>
            {!isEdit && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handlePublish}
                loading={saving}
              >
                保存并发布
              </Button>
            )}
            <Button onClick={() => navigate(-1)}>取消</Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  );
}
