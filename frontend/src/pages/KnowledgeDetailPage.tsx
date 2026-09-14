import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography, Tag, Space, Button, Spin, message, Modal, List, Input, Tooltip, Divider,
} from 'antd';
import {
  EditOutlined, SendOutlined, RollbackOutlined, ArrowLeftOutlined,
  HeartOutlined, HeartFilled, StarOutlined, StarFilled, DeleteOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  getKnowledgeArticle, publishKnowledgeArticle, withdrawKnowledgeArticle,
  likeArticle, unlikeArticle, favoriteArticle, unfavoriteArticle,
  getComments, createComment, deleteComment, submitReview,
} from '@/api/knowledge';
import { useAuthStore } from '@/stores/auth';
import type { KnowledgeArticle, KnowledgeComment } from '@/types';

const { Title, Text } = Typography;
const { TextArea } = Input;

export default function KnowledgeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Article state
  const [article, setArticle] = useState<KnowledgeArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Interaction state
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  // Comment state
  const [comments, setComments] = useState<KnowledgeComment[]>([]);
  const [commentTotal, setCommentTotal] = useState(0);
  const [commentPage, setCommentPage] = useState(1);
  const [commentLoading, setCommentLoading] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

  // Review state
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchArticle = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getKnowledgeArticle(parseInt(id, 10));
      setArticle(data);
      setLiked(data.likedByMe ?? false);
      setLikeCount(data.likeCount ?? 0);
      setFavorited(data.favoritedByMe ?? false);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchComments = useCallback(async () => {
    if (!id) return;
    setCommentLoading(true);
    try {
      const data = await getComments(parseInt(id, 10), commentPage, 10);
      setComments(data.items);
      setCommentTotal(data.pagination.total);
    } catch {
      // Non-critical
    } finally {
      setCommentLoading(false);
    }
  }, [id, commentPage]);

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const isAuthor = article && user && article.authorId === user.id;

  // ---- Like ----
  const handleLike = async () => {
    if (!article) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await unlikeArticle(article.id);
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } else {
        await likeArticle(article.id);
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '操作失败');
    } finally {
      setLikeLoading(false);
    }
  };

  // ---- Favorite ----
  const handleFavorite = async () => {
    if (!article) return;
    setFavLoading(true);
    try {
      if (favorited) {
        await unfavoriteArticle(article.id);
        setFavorited(false);
        message.success('已取消收藏');
      } else {
        await favoriteArticle(article.id);
        setFavorited(true);
        message.success('已收藏');
      }
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '操作失败');
    } finally {
      setFavLoading(false);
    }
  };

  // ---- Comment ----
  const handleSubmitComment = async () => {
    if (!id || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await createComment(parseInt(id, 10), newComment.trim());
      setNewComment('');
      message.success('评论成功');
      setCommentPage(1);
      fetchComments();
      // Update comment count
      setArticle((prev) => prev ? { ...prev, commentCount: (prev.commentCount ?? 0) + 1 } : prev);
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '评论失败');
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = (commentId: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确认删除此评论？',
      onOk: async () => {
        try {
          await deleteComment(commentId);
          message.success('评论已删除');
          fetchComments();
          setArticle((prev) => prev ? { ...prev, commentCount: Math.max(0, (prev.commentCount ?? 1) - 1) } : prev);
        } catch (err: any) {
          message.error(err?.response?.data?.error?.message || '删除失败');
        }
      },
    });
  };

  // ---- Publish / Withdraw ----
  const handlePublish = () => {
    if (!article) return;
    Modal.confirm({
      title: '确认发布',
      content: '发布后所有员工可见，确认发布？',
      onOk: async () => {
        try {
          await publishKnowledgeArticle(article.id);
          message.success('发布成功');
          fetchArticle();
        } catch (err: any) {
          message.error(err?.response?.data?.error?.message || '发布失败');
        }
      },
    });
  };

  const handleWithdraw = () => {
    if (!article) return;
    Modal.confirm({
      title: '确认撤回',
      content: '撤回后其他员工将无法查看此文章，确认撤回？',
      onOk: async () => {
        try {
          await withdrawKnowledgeArticle(article.id);
          message.success('撤回成功');
          fetchArticle();
        } catch (err: any) {
          message.error(err?.response?.data?.error?.message || '撤回失败');
        }
      },
    });
  };

  // ---- Submit Review ----
  const handleSubmitReview = async () => {
    if (!article) return;
    setReviewLoading(true);
    try {
      await submitReview(article.id);
      message.success('已提交审核');
      fetchArticle();
    } catch (err: any) {
      message.error(err?.response?.data?.error?.message || '提交审核失败');
    } finally {
      setReviewLoading(false);
    }
  };

  // ---- Loading / Error ----
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <p style={{ color: '#ff4d4f', marginBottom: 16 }}>{error || '文章不存在'}</p>
        <Button onClick={() => navigate('/app/knowledge')}>返回列表</Button>
      </div>
    );
  }

  const statusTag = () => {
    switch (article.status) {
      case 'PUBLISHED': return <Tag color="green">已发布</Tag>;
      case 'DRAFT': return <Tag color="orange">草稿</Tag>;
      case 'WITHDRAWN': return <Tag color="red">已撤回</Tag>;
      case 'TAKEN_DOWN': return <Tag color="volcano">已下架</Tag>;
      case 'PENDING_REVIEW': return <Tag color="purple">审核中</Tag>;
      default: return <Tag>{article.status}</Tag>;
    }
  };

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

      <Title level={3}>{article.title}</Title>

      <Space style={{ marginBottom: 24 }} wrap>
        {article.category && <Tag color="blue">{article.category.name}</Tag>}
        {statusTag()}
        {article.author && <Text type="secondary">作者：{article.author.name}</Text>}
        {article.publishedAt && (
          <Text type="secondary">发布时间：{new Date(article.publishedAt).toLocaleString('zh-CN')}</Text>
        )}
        {article.updatedAt && (
          <Text type="secondary">更新时间：{new Date(article.updatedAt).toLocaleString('zh-CN')}</Text>
        )}
      </Space>

      {/* Taken-down / pending review notice */}
      {(article.status === 'TAKEN_DOWN' || article.status === 'PENDING_REVIEW') && (
        <div style={{ background: '#fff2f0', border: '1px solid #ffccc7', padding: 12, borderRadius: 8, marginBottom: 16 }}>
          <Text type="danger">
            {article.status === 'TAKEN_DOWN' && (article.moderationReason || '该文章已被管理员下架')}
            {article.status === 'PENDING_REVIEW' && '该文章正在审核中，请等待管理员审核'}
          </Text>
        </div>
      )}

      {/* Author actions */}
      {isAuthor && (
        <Space style={{ marginBottom: 24 }} wrap>
          {(article.status === 'DRAFT' || article.status === 'PUBLISHED' || article.status === 'TAKEN_DOWN') && (
            <Button icon={<EditOutlined />} onClick={() => navigate(`/app/knowledge/editor/${article.id}`)}>
              编辑
            </Button>
          )}
          {article.status === 'DRAFT' && (
            <Button type="primary" icon={<SendOutlined />} onClick={handlePublish}>
              发布
            </Button>
          )}
          {article.status === 'PUBLISHED' && (
            <Button danger icon={<RollbackOutlined />} onClick={handleWithdraw}>
              撤回
            </Button>
          )}
          {(article.status === 'TAKEN_DOWN') && (
            <Button type="primary" icon={<ReloadOutlined />} loading={reviewLoading} onClick={handleSubmitReview}>
              重新提交审核
            </Button>
          )}
        </Space>
      )}

      {/* Like / Favorite bar */}
      <div style={{ marginBottom: 24, display: 'flex', gap: 24 }}>
        <Tooltip title={liked ? '取消点赞' : '点赞'}>
          <Button
            type="text"
            icon={liked ? <HeartFilled style={{ color: '#ff4d4f' }} /> : <HeartOutlined />}
            loading={likeLoading}
            onClick={handleLike}
          >
            {likeCount > 0 ? likeCount : ''}
          </Button>
        </Tooltip>
        <Tooltip title={favorited ? '取消收藏' : '收藏'}>
          <Button
            type="text"
            icon={favorited ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />}
            loading={favLoading}
            onClick={handleFavorite}
          />
        </Tooltip>
      </div>

      {/* Article summary */}
      {article.summary && (
        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 24 }}>
          <Text type="secondary">{article.summary}</Text>
        </div>
      )}

      {/* Article content */}
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 15 }}>
        {article.content}
      </div>

      {/* Comments section */}
      <Divider />
      <Title level={4}>评论 ({article.commentCount ?? commentTotal})</Title>

      {/* Comment input */}
      {user && (
        <div style={{ marginBottom: 24 }}>
          <TextArea
            rows={3}
            placeholder="写下你的评论..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            maxLength={2000}
            showCount
          />
          <div style={{ marginTop: 8, textAlign: 'right' }}>
            <Button
              type="primary"
              loading={submittingComment}
              disabled={!newComment.trim()}
              onClick={handleSubmitComment}
            >
              发表评论
            </Button>
          </div>
        </div>
      )}

      {/* Comment list */}
      <Spin spinning={commentLoading}>
        {comments.length === 0 && !commentLoading ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#999' }}>暂无评论</div>
        ) : (
          <List
            dataSource={comments}
            pagination={commentTotal > 10 ? {
              current: commentPage,
              pageSize: 10,
              total: commentTotal,
              onChange: setCommentPage,
              size: 'small',
            } : undefined}
            renderItem={(item) => (
              <List.Item
                actions={
                  user && !item.isDeleted && item.author.id === user.id
                    ? [
                        <Button
                          key="delete"
                          type="text"
                          danger
                          size="small"
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteComment(item.id)}
                        />,
                      ]
                    : undefined
                }
              >
                <List.Item.Meta
                  title={
                    <Space>
                      <Text strong>{item.author.name}</Text>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(item.createdAt).toLocaleString('zh-CN')}
                      </Text>
                    </Space>
                  }
                  description={
                    item.isDeleted ? (
                      <Text type="secondary" style={{ fontStyle: 'italic' }}>
                        该评论已删除
                      </Text>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap' }}>{item.content}</div>
                    )
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Spin>
    </div>
  );
}
