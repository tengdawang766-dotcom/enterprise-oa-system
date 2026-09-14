# API Reference

All routes are prefixed with `/api/v1`.

---

## Health

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Liveness probe — always returns 200 if process is running |
| GET | `/ready` | None | Readiness probe — checks database connectivity |

---

## Auth

No authentication required.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/auth/sessions` | Public | Login (sets httpOnly cookie `token`) |
| DELETE | `/auth/session` | Public | Logout (clears cookie) |

---

## Me (Current User)

Requires authentication + force-password-change check.

### Profile

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/me` | Any | Get current user profile |
| GET | `/me/work-overview` | Any | Get work dashboard overview |
| PATCH | `/me/password` | Any | Change password (clears session) |
| PATCH | `/me/contact` | Any | Update contact info (workEmail, phone) |

### My Announcements

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/me/announcements` | EMPLOYEE | List published announcements (paginated) |
| POST | `/me/announcements/:id/open` | EMPLOYEE | Open announcement (records first read) |

### My Leave Requests

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/me/leave-requests` | EMPLOYEE | List my leave requests (paginated) |
| GET | `/me/leave-requests/:id` | EMPLOYEE | Get my leave request detail |

### Approvals (Manager)

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/me/approval-tasks` | EMPLOYEE | List pending approval tasks (paginated) |
| GET | `/me/approval-history` | EMPLOYEE | List processed approval history (paginated) |
| GET | `/me/approvals/:id` | EMPLOYEE | Get approval detail |

---

## Leave Requests

Requires authentication + EMPLOYEE role.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| POST | `/leave-requests` | EMPLOYEE | Create and submit a leave request |
| POST | `/leave-requests/:id/cancel` | EMPLOYEE | Cancel a leave request (body: `expectedStateVersion`) |
| PATCH | `/leave-requests/:id` | EMPLOYEE | Edit a cancelled leave request |
| POST | `/leave-requests/:id/resubmit` | EMPLOYEE | Resubmit a cancelled leave request (body: `expectedStateVersion`) |
| POST | `/leave-requests/:id/approve` | EMPLOYEE | Approve a leave request (body: `comment`, `expectedStateVersion`) |
| POST | `/leave-requests/:id/reject` | EMPLOYEE | Reject a leave request (body: `reason`, `expectedStateVersion`) |

---

## Departments (Admin)

Requires authentication + ADMIN role.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/departments` | ADMIN | List departments (paginated) |
| POST | `/departments` | ADMIN | Create department |
| GET | `/departments/:id` | ADMIN | Get department detail |
| PATCH | `/departments/:id` | ADMIN | Update department |
| DELETE | `/departments/:id` | ADMIN | Delete department |
| GET | `/departments/:id/manager-candidates` | ADMIN | List manager candidates for department (paginated) |
| PUT | `/departments/:id/manager` | ADMIN | Set/replace department manager |
| DELETE | `/departments/:id/manager` | ADMIN | Remove department manager |

---

## Users (Admin)

Requires authentication + ADMIN role.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/users` | ADMIN | List users (paginated) |
| POST | `/users` | ADMIN | Create user |
| GET | `/users/:id` | ADMIN | Get user detail |
| PATCH | `/users/:id` | ADMIN | Update user profile |
| PUT | `/users/:id/department` | ADMIN | Transfer user to another department |
| POST | `/users/:id/password-reset` | ADMIN | Reset user password |
| POST | `/users/:id/disable` | ADMIN | Disable user account |

---

## Announcements (Admin)

Requires authentication + ADMIN role.

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/announcements` | ADMIN | List announcements (paginated) |
| POST | `/announcements` | ADMIN | Create draft announcement |
| GET | `/announcements/:id` | ADMIN | Get announcement detail |
| PATCH | `/announcements/:id` | ADMIN | Update draft announcement |
| DELETE | `/announcements/:id` | ADMIN | Delete draft announcement |
| POST | `/announcements/:id/publish` | ADMIN | Publish announcement |
| POST | `/announcements/:id/withdraw` | ADMIN | Withdraw published announcement |
| GET | `/announcements/:id/read-stats` | ADMIN | Get read statistics |
| GET | `/announcements/:id/read-list` | ADMIN | List users who read (paginated) |
| GET | `/announcements/:id/unread-list` | ADMIN | List users who haven't read (paginated) |

---

## Directory

Requires authentication + any role (ADMIN or EMPLOYEE).

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/directory` | Any | List directory entries (paginated, filterable) |
| GET | `/directory/departments` | Any | List departments for filter dropdown |
| GET | `/directory/:id` | Any | Get directory entry detail |


## Knowledge Sharing (completed)

Status: completed (Day 8). Migration: `20260913072642_add_knowledge_sharing`. 8 endpoints implemented, 35 backend tests passed.

| Method | Path | Description |
|---|---|---|
| GET | `/knowledge/categories` | Active predefined categories |
| GET | `/knowledge/articles` | Published article list |
| GET | `/knowledge/articles/:id` | Visible article detail |
| POST | `/knowledge/articles` | Create own draft |
| PATCH | `/knowledge/articles/:id` | Update own draft/published article |
| POST | `/knowledge/articles/:id/publish` | Publish own draft |
| POST | `/knowledge/articles/:id/withdraw` | Withdraw own published article |
| GET | `/knowledge/me/articles` | Current employee's articles |

## 知识社区增强 API（Day 9 已实现）

### 评论
- POST /knowledge/articles/:id/comments — 发表评论（1-1000字）
- DELETE /knowledge/comments/:id — 删除自己的评论（软删除）
- GET /knowledge/articles/:id/comments — 评论列表（分页）

### 点赞收藏
- PUT/DELETE /knowledge/articles/:id/like — 点赞/取消点赞（幂等）
- PUT/DELETE /knowledge/articles/:id/favorite — 收藏/取消收藏（幂等）
- GET /knowledge/me/favorites — 我的收藏（失效占位）

### 管理员
- GET /admin/knowledge/articles — 管理文章列表
- POST /admin/knowledge/articles/:id/take-down — 下架（附原因）
- POST /admin/knowledge/articles/:id/review/approve — 审核通过
- POST /admin/knowledge/articles/:id/review/reject — 审核驳回
- GET/POST/PUT /admin/knowledge/categories — 分类CRUD
- DELETE /admin/knowledge/comments/:id — 管理员删除评论

### AI
- POST /knowledge/ai/draft — AI生成草稿
- POST /knowledge/ai/rewrite — AI润色/结构整理
- POST /knowledge/ai/summary — AI生成摘要
- POST /knowledge/ai/query — AI知识问答（返回answer+sources）

AI限制：每分钟10次/用户，每日50次/用户，并发3个/用户。缺密钥返回503。
