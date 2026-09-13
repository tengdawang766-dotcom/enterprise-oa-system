# 企业 OA 协同办公系统 V1.0

## 项目概述

面向约 50 人的小型企业内部协同办公系统，提供组织架构管理、公告发布、请假审批等核心业务功能。采用前后端分离架构，支持管理员与普通员工两种角色，覆盖企业日常办公的基本需求。

---

## 核心业务模块

| 模块 | 说明 |
|------|------|
| 认证管理 | 登录/退出/强制改密/JWT Cookie 认证/密码重置 |
| 部门管理 | 部门 CRUD/负责人任命与卸任/删除约束检查 |
| 员工管理 | 员工 CRUD/部门调动/密码重置/停用启用 |
| 公告管理 | 草稿→发布→撤回状态流转/阅读统计/已读追踪 |
| 通讯录 | 全公司员工目录/搜索/部门筛选 |
| 请假审批 | 申请/编辑/撤回/重新提交/通过/驳回/操作日志 |
| 个人中心 | 个人资料编辑/员工工作台/负责人审批工作台 |

---

## 用户角色

| 角色 | 标识 | 说明 |
|------|------|------|
| 系统管理员 | `ADMIN` | 拥有所有管理功能：部门管理、员工管理、公告管理、通讯录 |
| 普通员工 | `EMPLOYEE` | 查看公告、通讯录、提交请假、查看个人资料。可被任命为部门负责人，获得审批权限 |

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端框架 | React + TypeScript | React 19 |
| 构建工具 | Vite | - |
| UI 组件库 | Ant Design | 6.x |
| 状态管理 | Zustand | - |
| HTTP 客户端 | Axios | 1.x |
| 后端框架 | Express + TypeScript | Express 4 |
| ORM | Prisma | 5.22.0 |
| 数据库 | MySQL | 5.7 |
| 认证 | JWT + HttpOnly Cookie + bcryptjs | - |
| 测试框架 | Vitest + Supertest | - |
| 部署 | Docker Compose + Nginx | 配置已就绪，未实际构建 |

---

## 系统架构

```
┌─────────────┐     HTTP/REST      ┌──────────────┐     Prisma     ┌─────────┐
│   浏览器     │ ◄──────────────── │   Express     │ ◄────────────  │  MySQL  │
│  (React SPA) │    JSON + Cookie   │  (Node.js)   │    SQL         │  5.7    │
└─────────────┘                    └──────────────┘                └─────────┘
       ▲                                    │
       │                                    │
       └─────── Nginx (生产环境) ────────────┘
                  反向代理 + 静态资源
```

**认证流程：** 登录成功 → 服务端签发 JWT → 写入 HttpOnly Cookie → 后续请求自动携带 → 服务端验证 JWT + tokenVersion

---

## 目录结构

```
企业管理系统/
├── 01-需求分析/               # 业务需求、功能定义
│   ├── 需求分析.md
│   ├── 需求文档.md
│   └── 功能模块.md
├── 02-产品设计/               # 页面需求和 API 输入
│   ├── 页面需求.md
│   └── API输入文档.md
├── 03-技术方案/               # 技术选型、架构、数据库、API 设计
│   ├── 技术选型.md
│   ├── 系统架构.md
│   ├── 数据库设计.md
│   └── API设计.md
├── 04-开发规范/               # 前后端模块划分
│   ├── 前端模块划分.md
│   └── 后端模块划分.md
├── 05-UI设计/                 # 低保真布局草图
├── 06-项目日志/               # 每日开发日志
├── docs/                      # 部署与测试文档
│   ├── deployment.md          # 部署指南
│   └── test-report.md         # 测试报告
├── backend/                   # Express + TypeScript + Prisma
│   ├── src/
│   │   ├── common/            # 认证、异常、日志、响应、工具
│   │   ├── infrastructure/    # 配置、数据库连接
│   │   └── modules/           # 业务模块（auth/me/department/user/announcement/directory/leave）
│   ├── prisma/
│   │   ├── schema.prisma      # 数据库模型定义
│   │   ├── migrations/        # 数据库迁移记录
│   │   └── seed.ts            # 种子数据
│   ├── tests/                 # 后端集成测试
│   └── package.json
├── frontend/                  # React + TypeScript + Vite
│   ├── src/
│   │   ├── api/               # Axios 封装
│   │   ├── components/        # 公共组件（ErrorBoundary、路由守卫）
│   │   ├── layouts/           # 管理员/员工布局
│   │   ├── pages/             # 页面组件
│   │   ├── stores/            # Zustand 状态管理
│   │   ├── types/             # TypeScript 类型定义
│   │   └── utils/             # 工具函数
│   ├── tests/                 # 前端测试
│   └── package.json
├── .gitignore
└── README.md
```

---

## 环境要求

| 依赖 | 最低版本 | 推荐版本 |
|------|---------|---------|
| Node.js | v18 | v22.22.3 |
| npm | v9 | v10.9.8 |
| MySQL | 5.7 | 5.7.26 |
| Git | 2.x | 2.52.0 |

> Docker 部署需要额外安装 Docker 和 Docker Compose。

---

## 快速开始（本地开发）

### 1. 克隆项目

```bash
git clone <repo-url>
cd 企业管理系统
```

### 2. 创建数据库

```sql
CREATE DATABASE oa_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. 后端设置

```bash
cd backend

# 安装依赖
npm install

# 创建环境变量文件
cp .env.example .env
```

编辑 `.env`，修改数据库连接：

```env
# 数据库（注意：.env.example 中的 PostgreSQL 格式是错误的，应使用以下 MySQL 格式）
DATABASE_URL="mysql://root:root@localhost:3306/oa_system"

# JWT 密钥（生产环境必须修改）
JWT_SECRET="your-jwt-secret-at-least-32-chars"
JWT_EXPIRES_IN="24h"

# Cookie 密钥（生产环境必须修改）
COOKIE_SECRET="your-cookie-secret-at-least-32-chars"

# 服务端口
PORT=3000

# 开发环境标识
NODE_ENV=development

# 前端地址（用于 CORS）
FRONTEND_URL="http://localhost:5173"
```

```bash
# 生成 Prisma Client
npx prisma generate

# 执行数据库迁移
npx prisma migrate dev

# 导入种子数据
npx prisma db seed

# 启动开发服务器
npm run dev
```

后端将在 http://localhost:3000 启动。

### 4. 前端设置

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端将在 http://localhost:5173 启动。

### 5. 访问系统

打开浏览器访问 http://localhost:5173 ，使用下方默认账号登录。

---

## 环境变量说明

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `DATABASE_URL` | ✅ | - | MySQL 连接字符串，格式：`mysql://user:password@host:port/database` |
| `JWT_SECRET` | 生产必填 | `default-secret-change-me` | JWT 签名密钥，生产环境必须设置强密钥 |
| `JWT_EXPIRES_IN` | ❌ | `24h` | JWT 过期时间 |
| `COOKIE_SECRET` | 生产必填 | `default-cookie-secret` | Cookie 签名密钥 |
| `PORT` | ❌ | `3000` | 后端服务端口 |
| `NODE_ENV` | ❌ | `development` | 环境标识：`development` / `production` |
| `FRONTEND_URL` | ❌ | `http://localhost:5173` | 前端地址，用于 CORS 配置 |

> ⚠️ **注意：** `.env.example` 中的 `DATABASE_URL` 默认为 PostgreSQL 格式，这是错误的。实际应使用 MySQL 格式：`mysql://root:root@localhost:3306/oa_system`

---

## 默认账号（仅限开发环境）

| 账号 | 密码 | 角色 | 说明 |
|------|------|------|------|
| `admin` | `admin123` | 系统管理员 | 拥有所有管理功能 |
| `zhangsan` | `employee123` | 员工 | 技术部负责人，拥有审批权限 |
| `lisi` | `employee123` | 员工 | 普通员工 |

> 首次登录后系统会强制要求修改密码。

---

## 测试

### 后端测试

```bash
cd backend
npm test
```

测试文件：
- `auth.test.ts` — 认证相关（登录/退出/改密/token 校验）
- `day2.test.ts` — 部门与员工管理
- `day3.test.ts` — 公告与通讯录
- `day4-leave.test.ts` — 请假与审批流程
- `day5.test.ts` — 个人资料与工作台

### 前端测试

```bash
cd frontend
npm test
```

测试文件：
- `auth-store.test.ts` — 认证状态管理
- `day3.test.ts` / `day3-components.test.tsx` — 公告组件
- `day4-leave-components.test.tsx` — 请假组件
- `day5-components.test.tsx` — 工作台组件
- `employee-page.test.ts` — 员工管理页面

---

## 生产构建

```bash
# 后端构建
cd backend
npm run build
# 产物输出到 backend/dist/

# 前端构建
cd frontend
npm run build
# 产物输出到 frontend/dist/
```

---

## Docker Compose 部署（配置已就绪）

> ⚠️ 开发机器未安装 Docker，以下配置已完成编写但未实际构建运行。

```bash
# 在项目根目录
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

**默认端口：**

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端（Nginx） | 80 | 生产环境入口 |
| 后端 API | 3000 | Express 服务 |
| 前端开发 | 5173 | Vite 开发服务器 |
| MySQL | 3306 | 数据库 |

---

## 演示流程

### 管理员操作

1. 使用 `admin/admin123` 登录
2. 首次登录 → 强制修改密码 → 进入管理后台
3. **部门管理**：查看部门列表、创建新部门、为部门指定负责人
4. **员工管理**：查看员工、创建员工、编辑信息、调换部门、重置密码
5. **公告管理**：创建草稿 → 发布公告 → 查看阅读统计 → 撤回公告
6. **通讯录**：按部门筛选、搜索员工

### 员工操作（以 zhangsan 为例）

1. 使用 `zhangsan/employee123` 登录
2. 首次登录 → 修改密码 → 进入员工工作台
3. **查看公告**：浏览已发布公告、标记已读
4. **提交请假**：选择假期类型、填写日期和原因 → 提交
5. **负责人审批**（zhangsan 是技术部负责人）：在审批页面查看待办 → 通过/驳回
6. **个人资料**：编辑联系方式

---

## 权限矩阵

| 功能 | ADMIN | EMPLOYEE | EMPLOYEE（部门负责人） |
|------|-------|----------|----------------------|
| 部门管理 | ✅ CRUD + 任命负责人 | ❌ | ❌ |
| 员工管理 | ✅ 全部操作 | ❌ | ❌ |
| 公告管理 | ✅ 创建/发布/撤回 | ❌ | ❌ |
| 查看公告 | ✅ | ✅ | ✅ |
| 通讯录 | ✅ | ✅ | ✅ |
| 提交请假 | ❌ | ✅ | ✅ |
| 审批请假 | ❌ | ❌ | ✅（仅本部门） |
| 个人资料 | ✅ | ✅ | ✅ |
| 工作台 | 管理后台 | 员工工作台 | 员工工作台 + 待审批 |

---

## 请假状态流转

```
                  编辑后重新提交
        ┌─────────────────────────┐
        │                         │
        ▼                         │
    [草稿/DRAFT] ──提交──→ [待审批/PENDING]
                               │    ▲
                          通过 │    │ 驳回后编辑重新提交
                               ▼    │
                    [已通过/APPROVED] [已驳回/REJECTED]

```

**操作权限：**
- 员工：创建、编辑草稿、提交、撤回（仅待审批状态）、重新提交（仅已驳回状态）
- 负责人：通过、驳回（仅待审批状态，且仅限本部门员工）

---

## 公告状态流转

```
[草稿/DRAFT] ──发布──→ [已发布/PUBLISHED] ──撤回──→ [已撤回/WITHDRAWN]
```

**操作权限：**
- 管理员可创建草稿、发布、撤回
- 草稿状态可编辑和删除
- 已撤回公告不可再操作

---

## 关键技术决策

1. **JWT + HttpOnly Cookie 认证**：避免 XSS 攻击窃取 token，配合 `tokenVersion` 实现服务端可控的 token 失效
2. **强制改密中间件**：新建用户默认密码 + `mustChangePassword` 标记，确保用户首次登录修改密码
3. **乐观并发控制**：请假审批使用 `stateVersion` 字段防止并发审批冲突
4. **快照字段**：请假单保存申请人、审批人姓名快照，避免用户信息变更后历史数据不一致
5. **路由级懒加载**：使用 `React.lazy + Suspense` 按需加载页面组件，减少首屏加载时间
6. **全局错误边界**：`ErrorBoundary` 组件捕获前端渲染异常，提供友好错误页面
7. **统一响应格式与错误码**：所有 API 返回统一 JSON 结构，业务错误使用语义化错误码
8. **源码与产物隔离**：Vitest 配置排除 `dist` 目录，构建前清理旧产物

---

## 已知限制

1. **单租户架构**：仅支持单企业使用，不支持多租户隔离
2. **无文件上传**：公告不支持附件，请假不支持证明材料上传
3. **无消息通知**：缺少站内消息、邮件或短信通知
4. **无操作日志审计**：仅请假模块有操作日志，其他模块缺少审计日志
5. **审批流单一**：仅支持单级审批（部门负责人），不支持多级审批链
6. **无假期额度管理**：不跟踪年假/病假额度余额
7. **Docker 未实际构建**：配置已完成但未在开发机器上运行验证
8. **无国际化**：仅支持中文界面
9. **数据库无软删除**：删除操作为物理删除

---

## 未来规划

- [ ] 文件上传（公告附件、请假证明）
- [ ] 站内消息通知 + 邮件通知
- [ ] 多级审批流程配置
- [ ] 假期额度管理与年假统计
- [ ] 全局操作审计日志
- [ ] 数据导出（Excel）
- [ ] 移动端适配 / 小程序
- [ ] 多租户架构升级

---

## 文档阅读顺序

1. **01-需求分析** — 了解项目要做什么
2. **02-产品设计** — 了解页面需求和 API 输入
3. **03-技术方案** — 了解技术实现方案
4. **04-开发规范** — 了解代码组织方式
5. **05-UI设计** — 参考界面布局
6. **[核心技术复盘与讲解](docs/核心技术复盘与讲解.md)** — 系统学习认证、Prisma、状态机、并发、React 与部署安全
7. **docs/deployment.md** — 部署指南
8. **docs/test-report.md** — 测试报告

---

## 开发进度

| 阶段 | 主题 | 状态 |
|------|------|------|
| Day 1 | 项目初始化与认证基础 | ✅ 完成 |
| Day 2 | 部门、员工与负责人管理 | ✅ 完成 |
| Day 3 | 公告与通讯录 | ✅ 完成 |
| Day 4 | 请假申请与审批 | ✅ 完成 |
| Day 5 | 个人资料与工作台 | ✅ 完成 |
| Day 6 | 全系统回归与打磨 | ✅ 完成 |
| Day 7 | 文档整理与交付 | ✅ 完成 |

---

## 许可证

本项目仅用于学习和演示目的。


## 内部知识分享（已完成）

> 状态：已完成（Day 8）。本文段为开发前方案，功能和测试数据将在实现并验证后回写。

新增员工内部知识分享模块，用于沉淀操作指南、技术经验和工作复盘。第一版计划提供文章列表、详情、编辑和“我的文章”页面，支持草稿、发布、修改、撤回、标题搜索、分类筛选和分页。

- 权限：仅已登录且状态为 `ENABLED` 的 `EMPLOYEE` 使用；部门负责人沿用 EMPLOYEE 身份。
- 可见性：已发布文章对所有有效员工可见；草稿和已撤回文章仅作者可见。
- 数据归属：创建、修改、发布和撤回均以后端 `currentUser.userId` 为准。
- 分类：第一版使用系统预置分类，通过只读分类接口供表单和筛选使用；不提供分类管理页面。
- 本期边界：不包含评论、点赞、AI 助手和跨系统统一登录。
