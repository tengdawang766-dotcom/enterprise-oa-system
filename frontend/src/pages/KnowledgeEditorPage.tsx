import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Form, Input, Select, Button, Space, Spin, message, Drawer, Tabs,
} from 'antd';
import { SaveOutlined, SendOutlined, ArrowLeftOutlined, RobotOutlined } from '@ant-design/icons';
import {
  getKnowledgeArticle,
  getKnowledgeCategories,
  createKnowledgeArticle,
  updateKnowledgeArticle,
  publishKnowledgeArticle,
  aiDraft,
  aiRewrite,
  aiSummary,
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

  // AI drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiTab, setAiTab] = useState('draft');

  // Draft tab
  const [draftTopic, setDraftTopic] = useState('');
  const [draftPoints, setDraftPoints] = useState('');
  const [draftRequirements, setDraftRequirements] = useState('');
  const [draftResult, setDraftResult] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);

  // Rewrite tab
  const [rewriteText, setRewriteText] = useState('');
  const [rewriteMode, setRewriteMode] = useState('polish');
  const [rewriteResult, setRewriteResult] = useState('');
  const [rewriteLoading, setRewriteLoading] = useState(false);
  const [rewriteSnapshot, setRewriteSnapshot] = useState(''); // snapshot of input when AI started

  // Summary tab
  const [summaryText, setSummaryText] = useState('');
  const [summaryResult, setSummaryResult] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summarySnapshot, setSummarySnapshot] = useState(''); // snapshot of content when AI started

  const isEdit = !!id;

  // AI cancellation: AbortController for in-flight requests, generationId to prevent stale responses
  const aiAbortRef = useRef<AbortController | null>(null);
  const aiGenerationRef = useRef(0);

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

  // ---- AI Cancel ----
  const cancelAi = useCallback(() => {
    aiAbortRef.current?.abort();
    aiAbortRef.current = null;
    aiGenerationRef.current += 1; // invalidate any in-flight response
  }, []);

  // ---- AI Handlers ----

  const handleAiDraft = async () => {
    if (!draftTopic.trim()) {
      message.warning('请输入主题');
      return;
    }
    cancelAi(); // abort previous request if any
    const gen = ++aiGenerationRef.current;
    const controller = new AbortController();
    aiAbortRef.current = controller;

    setDraftLoading(true);
    setDraftResult('');
    try {
      const data = await aiDraft(
        draftTopic.trim(),
        draftPoints.trim() || undefined,
        draftRequirements.trim() || undefined,
        controller.signal,
      );
      if (gen !== aiGenerationRef.current) return; // stale response, discard
      setDraftResult(data.content);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return; // user cancelled
      if (gen !== aiGenerationRef.current) return;
      message.error(err?.response?.data?.error?.message || 'AI生成失败');
    } finally {
      setDraftLoading(false); // always reset loading
      if (aiAbortRef.current === controller) aiAbortRef.current = null;
    }
  };

  const handleAiRewrite = async () => {
    if (!rewriteText.trim()) {
      message.warning('请输入需要润色的文本');
      return;
    }
    cancelAi();
    const gen = ++aiGenerationRef.current;
    const controller = new AbortController();
    aiAbortRef.current = controller;

    setRewriteLoading(true);
    setRewriteResult('');
    setRewriteSnapshot(rewriteText); // save snapshot
    try {
      const data = await aiRewrite(rewriteText.trim(), rewriteMode, controller.signal);
      if (gen !== aiGenerationRef.current) return;
      setRewriteResult(data.content);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return;
      if (gen !== aiGenerationRef.current) return;
      message.error(err?.response?.data?.error?.message || 'AI润色失败');
    } finally {
      setRewriteLoading(false);
      if (aiAbortRef.current === controller) aiAbortRef.current = null;
    }
  };

  const handleAiSummary = async () => {
    if (!summaryText.trim()) {
      message.warning('请输入内容');
      return;
    }
    cancelAi();
    const gen = ++aiGenerationRef.current;
    const controller = new AbortController();
    aiAbortRef.current = controller;

    setSummaryLoading(true);
    setSummaryResult('');
    setSummarySnapshot(summaryText); // save snapshot
    try {
      const data = await aiSummary(summaryText.trim(), controller.signal);
      if (gen !== aiGenerationRef.current) return;
      setSummaryResult(data.content);
    } catch (err: any) {
      if (err?.name === 'CanceledError' || err?.code === 'ERR_CANCELED' || err?.name === 'AbortError') return;
      if (gen !== aiGenerationRef.current) return;
      message.error(err?.response?.data?.error?.message || 'AI摘要失败');
    } finally {
      setSummaryLoading(false);
      if (aiAbortRef.current === controller) aiAbortRef.current = null;
    }
  };

  const insertToContent = (text: string, snapshot?: string, currentValue?: string) => {
    // Expired result protection: if snapshot provided and input has changed, BLOCK insertion
    if (snapshot !== undefined && currentValue !== undefined && snapshot !== currentValue) {
      message.error('输入内容已变化，AI结果已失效，请重新生成。');
      return; // do NOT insert
    }
    const currentContent = form.getFieldValue('content') || '';
    form.setFieldsValue({
      content: currentContent ? currentContent + '\n\n' + text : text,
    });
    message.success('已插入到正文');
    setDrawerOpen(false);
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>{isEdit ? '编辑文章' : '新建文章'}</Title>
        <Button icon={<RobotOutlined />} onClick={() => setDrawerOpen(true)}>
          AI辅助
        </Button>
      </div>

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

      {/* AI Drawer */}
      <Drawer
        title="AI辅助写作"
        placement="right"
        width={480}
        open={drawerOpen}
        onClose={() => { cancelAi(); setDrawerOpen(false); }}
      >
        <Tabs
          activeKey={aiTab}
          onChange={setAiTab}
          items={[
            {
              key: 'draft',
              label: '生成草稿',
              children: (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <Input
                      placeholder="请输入文章主题"
                      value={draftTopic}
                      onChange={(e) => setDraftTopic(e.target.value)}
                      maxLength={200}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <TextArea
                      placeholder="要点（可选，每行一个）"
                      value={draftPoints}
                      onChange={(e) => setDraftPoints(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <TextArea
                      placeholder="其他要求（可选）"
                      value={draftRequirements}
                      onChange={(e) => setDraftRequirements(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <Button
                    type="primary"
                    loading={draftLoading}
                    onClick={handleAiDraft}
                    style={{ marginBottom: 16 }}
                  >
                    生成草稿
                  </Button>
                  {draftResult && (
                    <div>
                      <div style={{ marginBottom: 8, fontWeight: 500 }}>生成结果：</div>
                      <div style={{
                        background: '#f5f5f5',
                        padding: 12,
                        borderRadius: 8,
                        whiteSpace: 'pre-wrap',
                        maxHeight: 400,
                        overflow: 'auto',
                        marginBottom: 12,
                      }}>
                        {draftResult}
                      </div>
                      <Button size="small" type="primary" onClick={() => insertToContent(draftResult)}>
                        插入到正文
                      </Button>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'polish',
              label: '润色',
              children: (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <TextArea
                      placeholder="请输入需要润色的文本"
                      value={rewriteText}
                      onChange={(e) => setRewriteText(e.target.value)}
                      rows={5}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Select
                      value={rewriteMode}
                      onChange={setRewriteMode}
                      style={{ width: '100%' }}
                      options={[
                        { label: '润色优化', value: 'polish' },
                        { label: '整理结构', value: 'structure' },
                        { label: '精简缩减', value: 'simplify' },
                        { label: '扩展丰富', value: 'expand' },
                      ]}
                    />
                  </div>
                  <Button
                    type="primary"
                    loading={rewriteLoading}
                    onClick={handleAiRewrite}
                    style={{ marginBottom: 16 }}
                  >
                    开始润色
                  </Button>
                  {rewriteResult && (
                    <div>
                      <div style={{ marginBottom: 8, fontWeight: 500 }}>润色结果：</div>
                      <div style={{
                        background: '#f5f5f5',
                        padding: 12,
                        borderRadius: 8,
                        whiteSpace: 'pre-wrap',
                        maxHeight: 400,
                        overflow: 'auto',
                        marginBottom: 12,
                      }}>
                        {rewriteResult}
                      </div>
                      <Button size="small" type="primary" onClick={() => insertToContent(rewriteResult, rewriteSnapshot, rewriteText)}>
                        插入到正文
                      </Button>
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: 'summary',
              label: '生成摘要',
              children: (
                <div>
                  <div style={{ marginBottom: 12 }}>
                    <TextArea
                      placeholder="请输入正文内容以生成摘要"
                      value={summaryText}
                      onChange={(e) => setSummaryText(e.target.value)}
                      rows={6}
                    />
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Button
                      size="small"
                      onClick={() => {
                        const content = form.getFieldValue('content');
                        if (content) setSummaryText(content);
                        else message.warning('正文为空');
                      }}
                    >
                      使用当前正文
                    </Button>
                  </div>
                  <Button
                    type="primary"
                    loading={summaryLoading}
                    onClick={handleAiSummary}
                    style={{ marginBottom: 16 }}
                  >
                    生成摘要
                  </Button>
                  {summaryResult && (
                    <div>
                      <div style={{ marginBottom: 8, fontWeight: 500 }}>生成的摘要：</div>
                      <div style={{
                        background: '#f5f5f5',
                        padding: 12,
                        borderRadius: 8,
                        whiteSpace: 'pre-wrap',
                        maxHeight: 300,
                        overflow: 'auto',
                        marginBottom: 12,
                      }}>
                        {summaryResult}
                      </div>
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => {
                          if (summarySnapshot !== summaryText) {
                            message.warning('输入内容已变化，AI摘要可能不适用。已填入摘要字段，请手动检查。');
                          }
                          form.setFieldsValue({ summary: summaryResult });
                          message.success('已填入摘要字段');
                          setDrawerOpen(false);
                        }}
                      >
                        填入摘要字段
                      </Button>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Drawer>
    </div>
  );
}
