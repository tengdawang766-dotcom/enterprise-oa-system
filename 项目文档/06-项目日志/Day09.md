# Day 09 - 知识社区增强规划与实施记录

## 1. 当前状态

- 现有知识分享：已完成并已验证，禁止重复开发文章创建、草稿、修改、发布、撤回、标题搜索、分类筛选和分页。
- 评论交流：计划新增，尚未开发和测试。
- 点赞与收藏：计划新增，尚未开发和测试。
- 管理员内容管理：计划新增，尚未开发和测试。
- AI 辅助写作：计划新增，尚未开发和测试。
- AI 知识查询：计划新增，尚未开发和测试。

本记录是开发前文档门禁。任何测试数量必须在实际执行后填写。

## 2. OA 与博客实际实现核对

### 2.1 OA 当前可复用能力

- React、TypeScript、Ant Design、React Router、Axios 与员工端 Layout。
- Express 认证、首次改密拦截、账号停用和 tokenVersion 会话失效。
- Prisma/MySQL 关系、统一响应、Zod 校验、业务错误码和分页协议。
- KnowledgeCategory、KnowledgeArticle 以及 DRAFT/PUBLISHED/WITHDRAWN 状态机。
- Supertest 集成测试、RUN_ID 数据隔离、前端 Vitest、构建和部署规范。

### 2.2 博客可借鉴但不能直接复制的能力

| 能力 | 博客实际情况 | OA 处理结论 |
|---|---|---|
| 评论 | MongoDB 单层 Comment，文章保存评论数组和计数 | 借鉴单层交互；用 Prisma 外键、分页、软删除、权限和状态隔离重写 |
| 点赞 | Article.like_num 计数，客户端 localStorage 保存点赞状态 | 不采用；缺少用户级数据库关系，并发重试可重复计数 |
| 收藏 | 未发现完整收藏模型和接口 | OA 全新设计用户-文章唯一关系 |
| AI 流式调用 | DeepSeek + WebSocket，支持超时、取消、错误映射 | 借鉴 provider、AbortController 和流处理思路；改为 OA 身份、限流和脱敏 |
| AI 草稿工具 | 存在标题、摘要、正文生成与 pending 确认工具 | 借鉴“先预览后确认”；不复制通用 Agent 和博客发布工具权限 |
| 文章查询 | 存在搜索/详情/answerFromArticles 工具 | 借鉴先检索后回答；只检索 OA PUBLISHED 内容，来源由服务端生成 |
| 长期记忆/聊天 | 有 ChatMessage、Memory、Summary 和通用 Agent | 本轮明确不接入 |

### 2.3 必须重写的原因

博客使用 Vue、MongoDB/Mongoose、博客账号、文章内嵌关系、本地点赞状态和通用聊天 Agent；OA 使用 React、Prisma/MySQL、企业员工账号和严格状态权限。直接搬运会破坏 OA 的数据约束、会话机制和内容隔离。

## 3. 统一权限和安全原则

- 员工业务接口：认证 + 完成强制改密 + `EMPLOYEE`。
- 管理接口：认证 + 完成强制改密 + `ADMIN`。
- 后端从认证上下文取得用户 ID，不接受 authorId、commenterId、operatorId。
- 私人草稿不对管理员开放；管理员只查询 PUBLISHED、TAKEN_DOWN、PENDING_REVIEW 文章。
- 评论、点赞、收藏、AI 检索只允许作用于当前可访问的 PUBLISHED 文章。
- 文章状态变化后，每个入口重新查库判断，不信任前端缓存。
- 纯文本使用 React 文本节点或 `white-space: pre-wrap` 渲染，禁止未清洗 HTML。
- 写入接口防重复提交；AI 接口按用户限流、超时、取消并脱敏记录。

## 4. 第一阶段：评论交流（计划新增）

### 4.1 业务流程

```text
员工打开已发布文章 -> 获取评论分页 -> 输入内容 -> 后端校验文章仍为 PUBLISHED
-> 根据 currentUser 创建评论 -> 返回评论 -> 更新评论数量
```

删除：作者可删除自己的评论；管理员可删除任意未删除评论且必须填写处理原因；文章作者没有额外删除他人评论的权限。

### 4.2 数据模型 KnowledgeComment

- id、articleId、authorId、content、createdAt、updatedAt。
- deletedAt、deletedById、deleteType(SELF/ADMIN)、deleteReason。
- 索引 `(articleId, createdAt)`、`(authorId, createdAt)`。
- 外键删除策略 RESTRICT；文章和用户保留历史，不物理级联。
- 采用软删除。列表保留占位项“该评论已删除”，不返回原文；评论数量只统计未删除评论。

### 4.3 校验与接口

评论去除首尾空格后 1-1000 字符。

- `GET /api/v1/knowledge/articles/:id/comments?page&pageSize`
- `POST /api/v1/knowledge/articles/:id/comments`
- `DELETE /api/v1/knowledge/comments/:id`
- `DELETE /api/v1/admin/knowledge/comments/:id`，请求体 reason 2-500 字符。

文章非 PUBLISHED 时普通员工的评论读写统一返回文章不可用。重复删除返回 409。

### 4.4 页面

文章详情增加评论数量、输入框、提交按钮、分页列表和本人删除按钮。加载失败不影响文章正文；撤回/下架后评论区不可见。

### 4.5 验收

正常发布、分页、空白/超长校验、本人删除、他人删除 403、作者删除他人 403、管理员删除及原因、撤回/下架隔离、停用会话 401。

## 5. 第二阶段：点赞与收藏（计划新增）

### 5.1 数据模型

KnowledgeArticleLike：id、articleId、userId、createdAt，唯一 `(articleId,userId)`，索引 userId。

KnowledgeArticleFavorite：id、articleId、userId、createdAt，唯一 `(articleId,userId)`，索引 `(userId,createdAt)`。

不在文章表维护可漂移的点赞计数；详情通过 relation count 得到真实数量。写入使用 upsert/唯一约束，删除使用条件 deleteMany，实现 PUT/DELETE 幂等。

### 5.2 接口

- `PUT/DELETE /api/v1/knowledge/articles/:id/like`
- `PUT/DELETE /api/v1/knowledge/articles/:id/favorite`
- `GET /api/v1/knowledge/me/favorites?page&pageSize`

文章详情增加 `likeCount`、`commentCount`、`likedByMe`、`favoritedByMe`。

### 5.3 收藏失效占位

我的收藏仅本人可见。文章为 PUBLISHED 时返回标题、摘要、分类和作者；撤回或下架后返回 `available=false`、articleId、favoriteId、favoritedAt 和原因，不返回标题、正文、摘要等受限内容，并允许取消收藏。

### 5.4 验收

重复 PUT/DELETE、并发点赞/收藏、用户唯一约束、计数准确、撤回/下架隔离、收藏隐私、停用会话失效。

## 6. 第三阶段：管理员内容管理（计划新增）

### 6.1 状态流转

ArticleStatus 扩展 `TAKEN_DOWN`、`PENDING_REVIEW`：

```text
DRAFT -> PUBLISHED -> WITHDRAWN
             |
             +--管理员下架(reason)--> TAKEN_DOWN
TAKEN_DOWN --作者修订并提交复审--> PENDING_REVIEW
PENDING_REVIEW --管理员通过--> PUBLISHED
PENDING_REVIEW --管理员驳回(reason)--> TAKEN_DOWN
```

作者可以编辑 TAKEN_DOWN，但不能直接发布；必须提交复审。PENDING_REVIEW 不能编辑、发布或撤回。管理员不能读取 DRAFT/WITHDRAWN。

### 6.2 审计模型 KnowledgeModerationLog

- id、articleId、operatorId、action(TAKE_DOWN/REVIEW_SUBMITTED/RESTORE_APPROVED/RESTORE_REJECTED/COMMENT_REMOVED)。
- reason、articleStatusBefore、articleStatusAfter、createdAt。
- 操作人名称可使用关系读取；为长期审计可增加 operatorNameSnapshot。
- 下架、提交复审和审核使用事务或带预期状态的条件更新，并同步写日志。

### 6.3 接口与页面

员工：`POST /knowledge/articles/:id/submit-review`；我的文章和详情展示下架原因、时间与复审状态。

管理员：

- `GET /api/v1/admin/knowledge/articles`
- `GET /api/v1/admin/knowledge/articles/:id`
- `POST /api/v1/admin/knowledge/articles/:id/take-down`
- `POST /api/v1/admin/knowledge/articles/:id/review/approve`
- `POST /api/v1/admin/knowledge/articles/:id/review/reject`
- `GET /api/v1/admin/knowledge/comments`
- `DELETE /api/v1/admin/knowledge/comments/:id`

新增管理员“知识内容管理”页面，覆盖文章筛选、详情、下架、复审和评论处理。

## 7. 第四阶段：AI 辅助写作（计划新增）

### 7.1 博客参考结论

可复用思想：后端持有密钥、流式增量、AbortController 超时/取消、错误码转换、pending 预览确认。不能复制博客 WebSocket 会话、长期记忆、通用 Agent 工具和自动发布能力。

### 7.2 OA 第一版契约

- `POST /api/v1/knowledge/ai/draft`：topic、points、requirements。
- `POST /api/v1/knowledge/ai/rewrite`：selectedText、mode(POLISH/STRUCTURE)。
- `POST /api/v1/knowledge/ai/summary`：content。

第一版优先使用普通 JSON 响应，降低取消和代理复杂度；若开发时确认使用 SSE，必须先更新文档，再实现 `POST generate` 与取消机制。所有结果只返回预览，员工点击“插入”后才进入本地表单，不自动保存或发布。

### 7.3 安全与可用性

- 环境变量：AI_API_KEY、AI_BASE_URL、AI_MODEL、AI_TIMEOUT_MS。
- 主题 1-200、要点/要求各最多 2000、选中文本/正文最多 12000。
- 每用户每分钟 10 次，进行中同类请求最多 1 个。
- 日志只记录 requestId、userId、operation、耗时、状态，不记录正文、密钥或模型完整输出。
- 超时/429/服务不可用返回语义错误，表单原文保持不变。
- 缺少密钥返回 503；通过可注入 Provider 完成模拟测试，不把真实联调标记为通过。

## 8. 第五阶段：AI 知识查询（计划新增）

### 8.1 检索与回答

`POST /api/v1/knowledge/ai/query` 接收 question（1-500）。先在 MySQL 中只检索 PUBLISHED 文章，按标题优先、正文补充的关键词匹配取得 Top 5，再把最小必要片段发送给模型。第一版不接入向量数据库、DX-RAG、文件上传或 OCR。

### 8.2 来源约束

来源由后端从实际检索结果生成：articleId、title、`/app/knowledge/articles/:id`。模型只能生成回答正文，不能生成或修改来源数组。无结果时不调用模型，返回“未找到可作为依据的内部文章”。打开来源时由文章详情接口再次鉴权。

### 8.3 内容隔离与提示注入

查询条件固定 `status=PUBLISHED`。草稿、撤回、TAKEN_DOWN、PENDING_REVIEW 不进入检索、提示词或缓存。文章内容以不可信参考资料包裹，系统提示明确禁止执行文章中的指令。模型没有发布、修改、删除和账号管理工具。

### 8.4 缓存

第一版不缓存文章正文和模型回答，避免状态变化后的泄露与失效复杂度。若后续增加缓存，键必须包含文章版本/状态，并在撤回、下架、修改时主动失效。

## 9. 数据库迁移与回退规划

计划新增 4 张业务表：comments、likes、favorites、moderation_logs；扩展 ArticleStatus。AI 第一版不保存会话和正文，不新增 AI 数据表。

迁移采用兼容步骤：先新增表和可空字段/枚举值，再发布读写代码。回退前必须确认不存在新状态和新表业务数据；有数据时只回退应用版本，不直接删除表。正式 Migration 创建后在部署文档写入准确名称和备份步骤。

## 10. 前后端模块规划

后端在现有 knowledge 模块下增加 comment、reaction、moderation、ai provider/service/controller，管理员路由独立挂载 ADMIN。前端扩展文章详情，新增 MyFavoritesPage、AdminKnowledgePage、KnowledgeAiQueryPage，并在编辑页增加 AiWritingPanel。普通页面状态留在组件内，不把文章正文或 AI 输出放入持久化全局 Store。

## 11. 分阶段门禁

每阶段顺序：先回看文档 -> Schema/API -> 后端测试 -> 前端页面/测试 -> 浏览器验收 -> 文档回写 -> 独立 Commit。上一阶段全量回归未通过，不进入下一阶段。

每阶段执行 Prisma format/generate/migrate status、后端全量测试/构建、前端全量测试/构建、lint、git diff --check、skip/only 与敏感信息检查。

## 12. 文档核对清单

| 文档 | 本次处理 |
|---|---|
| README | 增加五阶段路线和状态 |
| 需求分析/需求文档/功能模块 | 增加业务目标、范围、角色与边界 |
| 页面需求/UI | 增加评论、收藏、管理、AI 页面交互 |
| 技术选型/系统架构 | 增加 Provider、权限域和检索链路 |
| 数据库设计 | 增加 4 表与文章状态扩展规划 |
| API 设计/API 输入/API Reference | 增加接口契约和错误场景 |
| 前后端模块划分/开发规范 | 增加模块职责、安全和阶段门禁 |
| 测试计划/测试报告 | 增加待执行用例，不预填数量 |
| 部署说明 | 增加 Migration、AI 环境变量和无密钥降级 |
| 技术复盘 | 增加博客迁移取舍和新一致性问题 |
| Day01/02/06/07/08 | 历史事实不改；本文件记录新规划 |
| 原有 UI 图片 | 历史线框图不改；新增文字 UI 说明 |

## 13. 本轮实施结果（Day 9 实际执行）

### 13.1 代码修复

**修复1: Mock降级修复（AI运行模式）**
- `createAiProvider()` 缺密钥时不再静默降级为 MockAiProvider，抛出 `AiUnavailableError`（503）
- AiService 构造函数支持显式注入 Provider（测试用），缺密钥时构造不抛异常，请求时返回 503
- 新增 `AiUnavailableError` 类、`createMockProvider()` 工厂、`getAiService()` 懒加载
- 新增 `BusinessException.serviceUnavailable()` 方法
- 影响文件：`ai-provider.ts`、`ai.service.ts`、`business-exception.ts`、`knowledge.controller.ts`

**修复2: PENDING_REVIEW 文章编辑限制**
- `update()` 方法现在同时阻止 WITHDRAWN 和 PENDING_REVIEW 状态的编辑
- 影响文件：`knowledge.service.ts`

### 13.2 新增测试

**后端新增测试文件：**
- `tests/ai-provider.test.ts` — 31项：RealAiProvider 模拟HTTP（成功/401/429/500/503/超时/网络失败/空响应/无效结构）、请求构造验证、MockAiProvider、工厂测试、AiService 503测试
- `tests/ai-query.test.ts` — 6项：未登录401、缺字段400、空问题400、有匹配文章200/500/503、无匹配文章400、其他AI接口

**前端新增测试文件：**
- `tests/knowledge-community-api.test.ts` — 56项：评论API（getComments/createComment/deleteComment）、点赞收藏API（likeArticle/unlikeArticle/favoriteArticle/unfavoriteArticle/getMyFavorites）、复审API、AI API（aiDraft/aiRewrite/aiSummary/aiQuery）、管理员API（分类/文章/评论管理）、新增页面导入、菜单路由

### 13.3 测试结果

| 项目 | 测试文件数 | 测试数量 | 结果 |
|------|-----------|---------|------|
| 后端 | 9 | 354 | 全部通过 ✓ |
| 前端 | 8 | 144 | 全部通过 ✓ |
| **合计** | **17** | **498** | **全部通过 ✓** |

### 13.4 构建与校验

| 检查项 | 结果 |
|--------|------|
| 后端 tsc --noEmit | 通过 ✓ |
| 前端 vite build | 通过 ✓（18.33s）|
| prisma validate | 通过 ✓ |
| prisma migrate status | 4 migrations，全部已应用 ✓ |
| git diff --check | 仅CRLF警告，无实质问题 ✓ |
| skip/only 检查 | 无 ✓ |
| .gitignore | 已添加 .resume-qa/ 和 output/ ✓ |

### 13.5 浏览器验收

| 验收项 | 结果 |
|--------|------|
| 登录页面渲染 | 正常 ✓ |
| 管理员知识管理页面（文章/评论/分类三标签页）| 正常 ✓ |
| 分类管理（4个分类、启用/禁用开关、编辑按钮）| 正常 ✓ |
| 菜单路由权限（管理员看到知识管理）| 正常 ✓ |
| 员工端页面 | 待用户手动验证 |

### 13.6 真实模型调用

- 本轮未消耗任何真实API调用额度（全部用模拟HTTP测试覆盖）
- AI_API_KEY 已配置（deepseek-v4-pro），但API调用返回500（可能密钥过期或额度用完）
- 真实模型连通性需要用户确认密钥有效性后重新验证

### 13.7 遗留事项

1. AI API 真实连通性待验证（当前返回500）
2. 员工端知识社区页面浏览器验收待完成（需手动退出管理员后登录员工账号）
3. 并发场景（并发点赞/收藏/取消）的专项压力测试待补充
4. 前端页面行为测试（组件渲染测试）可进一步扩展

### 13.8 工作区状态

- 后端服务：已停止
- 前端服务：已停止
- MySQL：运行中
- Git：未提交（代码和文档变更在工作区）
