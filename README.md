# 企业 OA 协同办公系统 V1.0

## 项目概述

面向约 50 人的小型企业内部 OA 系统，支持人员管理、公告发布、请假审批等核心业务。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React + TypeScript + Vite + Ant Design |
| 后端 | Node.js + Express + TypeScript + Prisma ORM |
| 数据库 | MySQL 5.7 |
| 认证 | JWT + HttpOnly Cookie |
| 测试 | Vitest + Supertest |
| 部署 | Docker Compose + Nginx（待完成） |

## 目录结构

```
从0到1写一个完整的项目/
├── 01-需求分析/           ← 业务需求、功能定义
├── 02-产品设计/           ← 页面需求和API输入
├── 03-技术方案/           ← 技术选型、架构、数据库、API设计
├── 04-开发规范/           ← 前后端模块划分
├── 05-UI设计/             ← 低保真布局草图 (29张)
├── 06-项目日志/           ← 每日开发日志
├── frontend/              ← React + TypeScript + Vite
├── backend/               ← Express + TypeScript + Prisma
├── .gitignore
└── README.md
```

## 开发环境

- Node.js v22.22.3
- npm 10.9.8
- MySQL 5.7.26 (phpstudy_pro)
- Git 2.52.0
- Docker: 未安装（部署阶段处理）

## 快速开始

### 后端

```bash
cd backend
npm install
cp .env.example .env  # 修改数据库连接信息
npx prisma generate
npx prisma migrate dev
npx prisma db seed
npm run dev
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

### 测试

```bash
cd backend
npm test
```

## 默认账号

| 账号 | 密码 | 角色 |
|------|------|------|
| admin | admin123 | 系统管理员 |
| zhangsan | employee123 | 员工（技术部负责人） |
| lisi | employee123 | 员工 |

## 开发进度

### Day 1 ✅ 项目初始化与认证基础

- [x] 项目初始化（Git、.gitignore）
- [x] 后端 Express + TypeScript 项目骨架
- [x] 前端 React + TypeScript + Vite 项目
- [x] Prisma Schema + 首次数据库迁移
- [x] 种子数据（管理员、部门、员工）
- [x] 统一响应格式、异常处理、日志
- [x] JWT + HttpOnly Cookie 认证
- [x] 登录、退出、当前用户、修改密码接口
- [x] 强制改密中间件
- [x] Vitest + Supertest 集成测试（12项全通过）
- [x] 前端测试 95项、后端测试 177项
- [x] 前后端 build 通过

### Day 2 ✅ 部门、员工与负责人管理

- [x] 部门管理后端（5个接口：CRUD + 删除约束检查）
- [x] 员工管理后端（7个接口：CRUD + 调部门 + 重置密码 + 停用）
- [x] 负责人管理后端（4个接口：候选人 + 任命/更换/卸任，含事务+并发控制）
- [x] 新增12个业务错误码
- [x] 后端集成测试 44项（总计56项全通过）
- [x] 前端认证基础设施（Axios/Zustand/Router/Guards）
- [x] 登录页、强制改密页、后台管理布局
- [x] 部门管理前端页面（CRUD + 负责人管理）
- [x] 员工管理前端页面（CRUD + 调部门 + 重置密码 + 停用）
- [x] 前后端 build 通过

### Day 3 ✅ 公告、通讯录

- [x] 公告管理后端（创建、编辑、发布、撤回、阅读统计）
- [x] 公告员工端（列表、详情、已读/未读筛选）
- [x] 通讯录后端 + 前端（搜索、部门筛选、详情查看）
- [x] 后端集成测试 89项（总计145项全通过）
- [x] 前端组件测试 33项

### Day 4 ✅ 请假申请与审批

- [x] 请假申请（创建、编辑、撤回、重新提交）
- [x] 审批流程（通过、驳回，含并发控制）
- [x] 部门负责人待办与历史
- [x] 请假详情与操作日志时间线
- [x] 后端集成测试 177项全通过
- [x] 前端组件测试 95项全通过

### Day 5 ✅ 个人资料与工作台

- [x] 个人资料页（查看 + 编辑联系方式）
- [x] 员工工作台（统计卡片、最近公告、最近请假、快捷入口）
- [x] 管理负责人工作台（待审批数量、待办列表）
- [x] 前后端 build 通过

### Day 6 ✅ 全系统回归与打磨

- [x] 源码与编译产物隔离（vitest exclude dist，build 前清理）
- [x] 修复 Layout 无限重渲染（useMemo selectedKeys）
- [x] 统一状态标签（status-labels.ts 单一数据源）
- [x] 统一日期格式化（date-format.ts，API 返回 YYYY-MM-DD / ISO 8601）
- [x] 路由级懒加载（React.lazy + Suspense）
- [x] ErrorBoundary 全局错误边界
- [x] NotFoundPage / NoPermissionPage 角色感知
- [x] 代码质量：提取 parseIdParam 共享工具、删除死代码、敏感字段查询优化
- [x] JWT Secret 生产环境强制配置
- [x] 跨平台构建清理（Node.js fs.rmSync）
- [x] ApprovalPage 错误状态 + 重试
- [x] 后端 177 + 前端 95 测试全通过
- [x] 浏览器验收（管理员/员工/负责人/403/404/未登录）

## 文档阅读顺序

1. **01-需求分析** - 了解项目要做什么
2. **02-产品设计** - 了解页面需求和API输入
3. **03-技术方案** - 了解技术实现方案
4. **04-开发规范** - 了解代码组织方式
5. **05-UI设计** - 参考界面布局

## 环境限制

- Docker 未安装，部署阶段需要安装
- MySQL 使用 phpstudy_pro，密码为 root/root（仅限本地开发）