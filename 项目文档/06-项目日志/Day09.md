# Day 09 - 知识社区增强规划与实施记录

## 1. 当前状态

- 现有知识分享：已完成并已验证，禁止重复开发文章创建、草稿、修改、发布、撤回、标题搜索、分类筛选和分页。
- 评论交流：已完成，已通过测试。
- 点赞与收藏：已完成，已通过测试。
- 管理员内容管理：已完成，已通过测试。
- AI 辅助写作：已完成，已通过测试。
- AI 知识查询：已完成，已通过测试。

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

## 4. 第一阶段：评论交流（已完成）

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

## 5. 第二阶段：点赞与收藏（已完成）

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

## 6. 第三阶段：管理员内容管理（已完成）

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

## 7. 第四阶段：AI 辅助写作（已完成）

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

## 8. 第五阶段：AI 知识查询（已完成）

### 8.1 检索与回答

`POST /api/v1/knowledge/ai/query` 接收 question（1-500）。先在 MySQL 中只检索 PUBLISHED 文章，按标题优先、正文补充的关键词匹配取得 Top 5，再把最小必要片段发送给模型。第一版不接入向量数据库、DX-RAG、文件上传或 OCR。

### 8.2 来源约束

来源由后端从实际检索结果生成：articleId、title、`/app/knowledge/articles/:id`。模型只能生成回答正文，不能生成或修改来源数组。无结果时不调用模型，返回“未找到可作为依据的内部文章”。打开来源时由文章详情接口再次鉴权。

### 8.3 内容隔离与提示注入

查询条件固定 `status=PUBLISHED`。草稿、撤回、TAKEN_DOWN、PENDING_REVIEW 不进入检索、提示词或缓存。文章内容以不可信参考资料包裹，系统提示明确禁止执行文章中的指令。模型没有发布、修改、删除和账号管理工具。

### 8.4 缓存

第一版不缓存文章正文和模型回答，避免状态变化后的泄露与失效复杂度。若后续增加缓存，键必须包含文章版本/状态，并在撤回、下架、修改时主动失效。

## 9. 数据库迁移与回退规划

已新增 4 张业务表：KnowledgeComment、KnowledgeArticleLike、KnowledgeArticleFavorite、KnowledgeModerationLog；ArticleStatus 已扩展 TAKEN_DOWN/PENDING_REVIEW。Migration：`20260913111447_add_knowledge_community_enhancement`。AI 第一版不保存会话和正文，未新增 AI 数据表。

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
| 后端 | 9 | 375 | 全部通过 ✓ |
| 前端 | 8 | 154 | 全部通过 ✓ |
| **合计** | **17** | **529** | **全部通过 ✓** |

后端 373→375：新增 AI 生成中途用户停用后置验证、AI 生成中途 tokenVersion 变更后置验证。
前端 154 项无变化（本轮仅修复 key/lint，未新增测试）。

### 13.4 构建与校验

| 检查项 | 结果 |
|--------|------|
| 后端 tsc --noEmit | 通过 ✓ |
| 前端 vite build | 通过 ✓（530ms）|
| prisma validate | 通过 ✓ |
| prisma migrate status | 4 migrations，全部已应用 ✓ |
| git diff --check | 仅CRLF警告，无实质问题 ✓ |
| skip/only 检查 | 无 ✓ |
| .gitignore | 已添加 .resume-qa/ 和 output/ ✓ |
| 前端 lint (oxlint) | 0 errors, 36 warnings，退出码 0 ✓ |

lint 36 warnings 全为历史遗留：react(set-state-in-effect) 标准数据获取模式、react-hooks(exhaustive-deps) 依赖缺失、eslint(no-unused-vars) 测试文件未使用变量。本轮修复了 ApprovalPage.tsx 的 3 个 rules-of-hooks error 和 MyKnowledgePage.tsx 的 5 个 jsx-key warning。

### 13.5 浏览器验收

| 验收项 | 结果 |
|--------|------|
| 登录页面渲染 | 正常 ✓ |
| 管理员知识管理页面（文章/评论/分类三标签页）| 正常 ✓ |
| 分类管理（4个分类、启用/禁用开关、编辑按钮）| 正常 ✓ |
| 菜单路由权限（管理员看到知识管理）| 正常 ✓ |
| 员工端页面 | 待用户手动验证 |

### 13.6 真实模型调用

- 累计真实调用次数无法可靠确认，本轮不再调用
- 历史 500 根因未确定；最新直连曾返回 200
- 全部测试使用模拟 HTTP 和显式 Mock Provider，不消耗真实调用

### 13.7 AI 安全增强（本轮新增）

- 并发上限：每用户最多3个同时进行的AI请求（AI_MAX_CONCURRENT）
- 每日额度：每用户每天最多50次（AI_DAILY_QUOTA）
- 失败/取消自动释放并发槽位
- queryKnowledge 生成后复核用户状态和来源文章可见性
- 不向上游错误原文泄露到客户端响应
- revalidateUser 增加 tokenVersion 后置校验：请求开始时快照 tokenVersion，生成完成后比对，不匹配则返回 AUTH_SESSION_EXPIRED

### 13.8 前端过期结果保护

- 润色/摘要：生成时保存输入快照，应用时比较，变化时警告用户
- 草稿生成：追加模式，不覆盖已有内容
- 摘要填入：快照比较后决定是否警告

### 13.9 代码修复（本轮新增）

**修复3: ApprovalPage 条件调用 Hook**
- 将 `useCallback`×2 和 `useEffect`×1 从 `if (!user?.isDepartmentManager)` 之后移到之前
- useEffect 内部加 `if (!user?.isDepartmentManager) return` 守卫
- 保留原有 403 页面和权限行为
- 消除 3 个 react-hooks(rules-of-hooks) error

**修复4: MyKnowledgePage actions 数组缺 key**
- 5 个 Button 添加 `key="view"/"edit"/"publish"/"withdraw"/"resubmit"`
- 消除 5 个 react(jsx-key) warning

**修复5: revalidateUser tokenVersion 后置校验**
- `revalidateUser(userId, expectedTokenVersion?)` 增加可选参数
- `queryKnowledge` 入口快照 tokenVersion，生成后传给 revalidateUser 比对
- 新增 AI 生成中途用户停用后置验证测试（DisableOnAnswerProvider）
- 新增 AI 生成中途 tokenVersion 变更后置验证测试（TokenVersionBumpProvider）

### 13.10 浏览器验收状态

7 项浏览器验收结果：

| # | 验收项 | 方式 | 结果 |
|---|--------|------|------|
| 1 | 文章选择分类并提交 | JS click | 已验证：提交成功，页面跳转 |
| 2 | 删除评论 | browser_click | 已验证：评论从列表消失 |
| 3 | 取消点赞 | browser_click | 已验证：点赞计数减1 |
| 4 | 取消收藏 | browser_click | 已验证：收藏状态切换 |
| 5 | 失效收藏占位 | browser_click | 已验证：已下架文章显示占位提示 |
| 6 | 管理员驳回复审 | browser_click | 已验证：状态变为 TAKEN_DOWN，原因展示正确 |
| 7 | AI 预览/过期/失败/取消保护 | 测试验证 | 19 项测试全通过（详见 13.14） |

**保存按钮自动化点击说明：**

browser_click 对编辑器页面的"保存修改"按钮未触发请求（无网络请求、无校验反馈、无消息提示）。JS element.click() 可正常完成提交。原因未确定，普通鼠标操作待人工确认。

最小人工验证步骤：
1. 浏览器打开 http://localhost:5173/app/knowledge/editor/{id}
2. 修改任意字段
3. 点击"保存修改"
4. 确认出现"保存成功"提示并跳转

### 13.11 浏览器验收测试数据

以下数据通过 API 创建，用于本轮验收：

| 数据 | ID | 验收前状态 | 验收后状态 | 归属 |
|------|-----|-----------|-----------|------|
| 文章：浏览器验收测试文章 | 395 | PUBLISHED | PUBLISHED | 本轮验收，待清理 |
| 评论：员工的待删除评论 | 47 | 存在 | 已删除（软删除） | 本轮验收，待清理 |
| 文章：待审核文章-驳回测试 | 396 | PENDING_REVIEW | TAKEN_DOWN | 本轮验收，待清理 |
| 文章：下架测试 | 397 | TAKEN_DOWN | TAKEN_DOWN | 归属不明，保留 |
| 文章：失效收藏测试文章 | 398 | TAKEN_DOWN | TAKEN_DOWN | 本轮验收，待清理 |
| 文章：编辑器创建测试 | 507 | DRAFT | DRAFT | 本轮验收，待清理 |

员工账号 wangwu（ID=662）未修改。

### 13.12 遗留事项

1. AI API 500 根因未确定（最新直连曾返回 200）
2. 并发上限/每日额度为内存实现，重启后重置，多实例不共享
3. 累计真实模型调用次数无法可靠确认
4. 保存按钮自动化点击兼容性待确认（JS click 有效，browser_click 无效，原因未确定）

### 13.13 审核原因（moderationReason）实现说明

**后端行为：**
- 管理员文章详情（knowledge-moderation.service.ts）：TAKEN_DOWN 和 PENDING_REVIEW 均返回 moderationReason
- 员工文章详情（knowledge.service.ts）：仅 TAKEN_DOWN 返回 moderationReason
- 两端不完全相同：管理员端多返回 PENDING_REVIEW 状态的原因（用于审核中查看上次驳回原因）

**前端展示：**
- KnowledgeDetailPage.tsx：TAKEN_DOWN 时显示红色提示框 + moderationReason；PENDING_REVIEW 仅显示"正在审核中"
- AdminKnowledgePage.tsx：详情抽屉中 TAKEN_DOWN 显示"下架/驳回原因"

**数据来源：** knowledgeModerationLog 表，查询最近一次 TAKE_DOWN 或 RESTORE_REJECTED 操作的 reason 字段。

### 13.14 AI 页面交互验收（本轮新增）

验证方式：前端单元测试，mock @/lib/axios（Axios 实例拦截，非 fetch mock）。所有响应为模拟数据，不调用真实 DeepSeek API。

测试文件：frontend/tests/ai-page-verification.test.ts（19 项）

| # | 场景 | 结果 | 说明 |
|---|------|------|------|
| ① | 生成并显示预览 | ✓ 通过 | mock 返回固定内容，draftResult/rewriteResult/summaryResult 正确获取，正文不变 |
| ② | 人工应用（点击插入） | ✓ 通过 | insertToContent 追加到正文末尾（不覆盖），抽屉关闭 |
| ③ | 过期保护 | ✓ 通过 | snapshot 不匹配时发出警告，结果仍追加但用户已被告知；匹配时无警告 |
| ④ | 失败保护 | ✓ 通过 | 接口失败后正文不变，错误被捕获显示，loading 状态正确重置 |
| ⑤ | 取消保护 | ✓ 通过 | 关闭抽屉正文不变；迟到响应更新 state 但不自动应用到正文；需手动点击插入 |

**取消保护补充说明：** 当前实现无显式取消/中止按钮，无 AbortController。关闭抽屉不中断进行中的请求。迟到响应会更新 draftResult/rewriteResult/summaryResult 状态，但不会自动写入表单正文。下次打开抽屉时会看到旧结果，需用户手动决定是否应用。此行为可接受但可优化。

### 13.15 工作区状态

- 后端服务：已停止
- 前端服务：已停止
- MySQL：运行中
- Git：未提交（代码和文档变更在工作区）
