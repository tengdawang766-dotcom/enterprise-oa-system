import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Input, Button, Space, Spin, Card, Empty } from 'antd';
import { SendOutlined, LinkOutlined } from '@ant-design/icons';
import { aiQuery } from '@/api/knowledge';
import type { AiQueryResponse } from '@/types';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function KnowledgeAskPage() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiQueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await aiQuery(question.trim());
      setResult(data);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '查询失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Title level={4}>知识查询</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        基于知识库中的文章，AI将为您解答问题并提供参考来源
      </Text>

      <div style={{ marginBottom: 24 }}>
        <TextArea
          rows={3}
          placeholder="请输入您的问题..."
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onPressEnter={(e) => {
            if (!e.shiftKey) {
              e.preventDefault();
              handleSubmit();
            }
          }}
          maxLength={1000}
          showCount
        />
        <div style={{ marginTop: 8, textAlign: 'right' }}>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={loading}
            disabled={!question.trim()}
            onClick={handleSubmit}
          >
            提问
          </Button>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size="large" />
          <div style={{ marginTop: 16, color: '#999' }}>AI正在查询知识库...</div>
        </div>
      )}

      {error && (
        <Card style={{ marginBottom: 16, borderColor: '#ffccc7' }}>
          <Text type="danger">{error}</Text>
        </Card>
      )}

      {result && (
        <div>
          <Card title="回答" style={{ marginBottom: 16 }}>
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{result.answer}</div>
          </Card>

          {result.sources && result.sources.length > 0 && (
            <Card title="参考来源">
              {result.sources.map((source) => (
                <div key={source.articleId} style={{ marginBottom: 8 }}>
                  <Button
                    type="link"
                    icon={<LinkOutlined />}
                    style={{ padding: 0 }}
                    onClick={() => navigate(`/app/knowledge/articles/${source.articleId}`)}
                  >
                    {source.title}
                  </Button>
                </div>
              ))}
            </Card>
          )}

          {(!result.sources || result.sources.length === 0) && (
            <Empty description="无参考来源" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          )}
        </div>
      )}

      {!loading && !result && !error && (
        <div style={{ textAlign: 'center', padding: 60, color: '#999' }}>
          输入问题后点击"提问"，AI将基于知识库为您解答
        </div>
      )}
    </div>
  );
}
