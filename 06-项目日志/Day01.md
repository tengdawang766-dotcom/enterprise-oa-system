# Day 01 - 项目初始化与认证基础

**日期**: 2026-09-05

## 今日完成

### 已实现且已测试

1. **项目初始化**
   - Git 仓库初始化
   - .gitignore 配置（排除 node_modules、.env、缓存等）
   - 首次提交包含所有文档和 UI 图片

2. **后端项目骨架**
   - Express + TypeScript 项目结构
   - 按业务模块分包（auth、me）
   - 统一响应格式（ApiResponse、sendSuccess、sendPaginated）
   - 异常体系（BusinessException + ErrorCode + 全局异常处理器）
   - Pino 日志
   - Zod 参数校验集成

3. **数据库**
   - Prisma Schema（6张核心表：users、departments、announcements、announcement_reads、leave_requests、leave_action_logs）
   - 首次迁移成功
   - 种子数据：管理员、2个部门、2个员工

4. **认证模块**
   - JWT + HttpOnly Cookie 认证
   - 登录接口 `POST /api/v1/auth/sessions`
   - 退出接口 `DELETE /api/v1/auth/session`
   - 当前用户接口 `GET /api/v1/me`
   - 修改密码接口 `PATCH /api/v1/me/password`
   - 强制改密中间件（mustChangePassword=true 时只允许特定接口）

5. **测试**
   - Vitest + Supertest 集成测试
   - 11 项测试全部通过
   - 覆盖场景：健康检查、未认证访问、正确/错误密码登录、当前用户、强制改密、密码修改、JWT 失效、停用账号、退出

6. **Build 验证**
   - 后端 TypeScript build 通过
   - 前端 Vite build 通过

### 已实现但未测试

- 无

### 尚未实现

- 员工管理（Day 2）
- 部门管理（Day 2）
- 公告模块（Day 3）
- 请假模块（Day 4）
- 前端页面（Day 2-5）
- Docker 部署（Day 6）

## 今日决策

1. **Prisma 版本选择**
   - Prisma 8.0.0-rc.12 CLI 变更较大，降级到 5.22.0 稳定版
   - 原因：Prisma 8 的 `generate` 命令不再可用，需要使用 `prisma orm` 子命令

2. **Express 版本选择**
   - 使用 Express 4.x 而非 5.x
   - 原因：Express 5 仍在 beta，类型定义不完善

3. **退出接口设计**
   - 退出接口不需要认证中间件
   - 原因：即使 JWT 已失效，用户也应该能清除浏览器 Cookie

## 今日问题

1. **npm 缓存损坏**
   - 现象：`npm install` 报错 `Cannot read properties of null (reading 'edgesOut')`
   - 解决：使用 `--legacy-peer-deps` 参数，或删除 node_modules 和 package-lock.json 重新安装

2. **Prisma Schema 关系歧义**
   - 现象：Department 模型有两个指向 User 的关系（users 和 manager）
   - 解决：添加显式关系名称 `@relation("UserDepartment")` 和 `@relation("DepartmentManager")`

3. **JWT 签名类型错误**
   - 现象：TypeScript 报错 `expiresIn` 类型不匹配
   - 解决：使用 `as jwt.SignOptions` 类型断言

4. **强制改密中间件路径匹配**
   - 现象：使用 `req.path` 匹配失败（路径是相对路由的）
   - 解决：改用 `req.originalUrl` 匹配完整路径

## AI 完成的工作

1. 创建后端项目结构和配置文件
2. 编写 Prisma Schema（基于数据库设计文档）
3. 实现认证模块（登录、退出、当前用户、改密）
4. 实现强制改密中间件
5. 编写 Vitest 集成测试
6. 修复 Prisma Schema 关系歧义
7. 修复 JWT 签名类型错误
8. 修复强制改密中间件路径匹配问题

## 认证 Review 发现的问题

1. **退出接口认证问题**
   - 原实现：退出接口需要认证中间件
   - 问题：JWT 失效后无法退出（无法清除 Cookie）
   - 修复：移除退出接口的认证要求，始终清除 Cookie

2. **强制改密路径匹配**
   - 原实现：使用 `req.path` 匹配
   - 问题：路径是相对路由的，不是完整路径
   - 修复：改用 `req.originalUrl` 匹配完整路径

## 实际测试结果

```
✓ health check should return 200
✓ should reject unauthenticated access to protected endpoint
✓ should login with correct credentials
✓ should reject wrong password
✓ should reject non-existent user
✓ should get current user with valid cookie
✓ should reject access to /me when mustChangePassword is true
✓ should allow password change when mustChangePassword is true
✓ should logout and clear cookie
✓ should reject disabled account login
✓ should invalidate JWT after password change

Test Files  1 passed (1)
     Tests  11 passed (11)
```

## 尚未验证

- Docker 部署（环境未安装）
- 生产环境 HTTPS 配置
- 并发场景下的认证安全性

## 明日计划

1. **员工管理**
   - 创建员工账号
   - 员工列表（分页、搜索、筛选）
   - 编辑员工资料
   - 调整部门
   - 重置密码
   - 启用/停用账号

2. **部门管理**
   - 部门列表
   - 创建/编辑/删除部门
   - 任命/更换/卸任负责人
   - 负责人候选人筛选

3. **测试**
   - 员工管理集成测试
   - 部门管理集成测试
   - 权限验证（管理员 vs 员工）
