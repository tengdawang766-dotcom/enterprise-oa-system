# Day 02 - 部门、员工与负责人管理

**日期**: 2026-09-06

## 今日完成

### 已实现且已测试

1. **部门管理后端**（5个接口）
   - 创建部门 `POST /api/v1/departments`
   - 部门列表（分页、搜索） `GET /api/v1/departments`
   - 部门详情 `GET /api/v1/departments/{id}`
   - 修改部门名称 `PATCH /api/v1/departments/{id}`
   - 删除部门 `DELETE /api/v1/departments/{id}`
   - 业务规则：名称唯一、删除前检查员工/负责人/历史请假

2. **员工管理后端**（7个接口）
   - 创建员工 `POST /api/v1/users`
   - 员工列表（分页、搜索、筛选） `GET /api/v1/users`
   - 员工详情 `GET /api/v1/users/{id}`
   - 修改基本资料 `PATCH /api/v1/users/{id}`
   - 调动部门 `PUT /api/v1/users/{id}/department`
   - 重置密码 `POST /api/v1/users/{id}/password-reset`
   - 停用账号 `POST /api/v1/users/{id}/disable`
   - 业务规则：账号唯一不可改、密码规则、负责人不能直接调部门/停用、管理员不能停用自己

3. **负责人管理后端**（4个接口，含在部门模块中）
   - 查询候选人 `GET /api/v1/departments/{id}/manager-candidates`
   - 任命/更换负责人 `PUT /api/v1/departments/{id}/manager`
   - 卸任负责人 `DELETE /api/v1/departments/{id}/manager`
   - 事务+并发控制（FOR UPDATE 锁定部门行）
   - 业务规则：候选人校验、待办检查、一人最多负责一个部门

4. **错误码扩展**
   - 新增12个业务错误码：DEPARTMENT_NAME_ALREADY_EXISTS、DEPARTMENT_NOT_EMPTY、USERNAME_ALREADY_EXISTS、ADMIN_CANNOT_DISABLE_SELF、USER_PENDING_LEAVE_EXISTS、MANAGER_MUST_BE_REMOVED_BEFORE_DISABLE、USER_IS_CURRENT_MANAGER、ADMIN_SELF_PASSWORD_RESET_NOT_ALLOWED、MANAGER_HAS_PENDING_LEAVE、MANAGER_HAS_PENDING_APPROVAL_TASKS、INVALID_MANAGER_CANDIDATE

5. **后端集成测试**（44项新增，56项总计）
   - 部门测试（9项）：创建、重复名称、空名称、员工权限、列表、详情、改名、删除空部门、有员工不能删除
   - 员工测试（16项）：创建、重复账号、非法密码、部门不存在、员工权限、列表搜索筛选、详情安全、资料修改、角色不可改、调部门、重置密码、停用、管理员不能停用自己
   - 负责人测试（10项）：候选人查询、任命、非本部门不能任命、非管理员权限、同一人不能多部门、更换、卸任、候选人排除已管理者、负责人不能直接停用
   - Day 1 测试 12/12 仍然通过

6. **前端认证与应用框架**
   - Axios 实例（withCredentials、401 去重拦截器）
   - Zustand 认证 Store（initAuth、login、logout、changePassword）
   - React Router 路由配置
   - AuthGuard / GuestGuard / RoleGuard / PasswordChangeGuard
   - 登录页、强制改密页、404页、403页

7. **前端后台管理布局**
   - Ant Design Layout（Sider + Header + Content）
   - 侧边栏导航（部门管理、员工管理）
   - 顶部用户菜单（退出登录）

8. **部门管理前端**
   - 部门列表表格（名称、负责人、创建时间、操作）
   - 新增/编辑部门名称弹窗
   - 删除确认（含后端错误原因展示）
   - 负责人管理弹窗（当前负责人、候选人搜索、任命/更换/卸任）

9. **员工管理前端**
   - 员工列表表格（账号、姓名、部门、角色、职务、状态、操作）
   - 分页、搜索、筛选（角色、状态、部门）
   - 创建员工弹窗
   - 编辑基本资料弹窗
   - 调整部门弹窗
   - 重置密码弹窗
   - 停用确认
   - 当前负责人标识

10. **前后端联调验证**（通过 curl + Vite proxy）
    - 管理员登录 → 强制改密 → 重新登录
    - 创建部门、创建员工、任命负责人、卸任负责人
    - 管理员不能停用自己（409）
    - 普通员工访问管理接口被拦截（403 PASSWORD_CHANGE_REQUIRED）

11. **Build 验证**
    - 后端 TypeScript 编译通过
    - 后端56项测试全部通过
    - 前端 Vite build 通过

### 已实现但未测试

- 浏览器可视化联调（browser 工具不可用，已通过 curl 验证全部 API）
- 负责人有待审批申请时的卸任/更换拒绝（leave_requests 表无测试数据）
- 并发场景下的事务竞态测试

### 尚未实现

- 公告模块
- 通讯录页面
- 请假申请
- 审批工作台
- 工作概览真实数据
- Docker 部署

## 后端接口清单

| 方法 | 路径 | 说明 | 状态 |
|------|------|------|------|
| POST | /api/v1/departments | 创建部门 | ✅ |
| GET | /api/v1/departments | 部门列表 | ✅ |
| GET | /api/v1/departments/{id} | 部门详情 | ✅ |
| PATCH | /api/v1/departments/{id} | 修改部门名称 | ✅ |
| DELETE | /api/v1/departments/{id} | 删除部门 | ✅ |
| GET | /api/v1/departments/{id}/manager-candidates | 负责人候选人 | ✅ |
| PUT | /api/v1/departments/{id}/manager | 任命/更换负责人 | ✅ |
| DELETE | /api/v1/departments/{id}/manager | 卸任负责人 | ✅ |
| POST | /api/v1/users | 创建员工 | ✅ |
| GET | /api/v1/users | 员工列表 | ✅ |
| GET | /api/v1/users/{id} | 员工详情 | ✅ |
| PATCH | /api/v1/users/{id} | 修改基本资料 | ✅ |
| PUT | /api/v1/users/{id}/department | 调动部门 | ✅ |
| POST | /api/v1/users/{id}/password-reset | 重置密码 | ✅ |
| POST | /api/v1/users/{id}/disable | 停用账号 | ✅ |

## 关键事务与权限实现

1. **负责人管理事务**：`setManager` 和 `removeManager` 使用 `prisma.$transaction` + `FOR UPDATE` 锁定部门行，防止竞态
2. **调动部门事务**：`transferDepartment` 在事务中检查负责人状态和待审批请假
3. **停用账号事务**：`disable` 在事务中检查负责人关系和待审批请假
4. **重置密码事务**：`resetPassword` 在事务中更新密码哈希、mustChangePassword 和 tokenVersion
5. **权限中间件链**：`authenticationMiddleware → forcePasswordChangeMiddleware → requireRole('ADMIN')`
6. **前端权限**：AuthGuard（未登录跳转）、GuestGuard（已登录跳转）、RoleGuard（角色限制）、PasswordChangeGuard（强制改密）

## 修改的主要文件

### 后端新增
- `backend/src/common/exception/error-code.ts` - 新增12个错误码
- `backend/src/modules/department/dto/department.dto.ts` - 部门 Zod 验证
- `backend/src/modules/department/department.service.ts` - 部门+负责人业务逻辑
- `backend/src/modules/department/department.controller.ts` - 部门+负责人路由
- `backend/src/modules/user/dto/user.dto.ts` - 员工 Zod 验证
- `backend/src/modules/user/user.service.ts` - 员工业务逻辑
- `backend/src/modules/user/user.controller.ts` - 员工路由
- `backend/tests/day2.test.ts` - 44项集成测试

### 后端修改
- `backend/src/app.ts` - 注册部门和员工路由，挂载权限中间件

### 前端新增
- `frontend/src/lib/axios.ts` - Axios 实例
- `frontend/src/types/index.ts` - TypeScript 类型定义
- `frontend/src/api/auth.ts` - 认证 API
- `frontend/src/api/departments.ts` - 部门 API
- `frontend/src/api/users.ts` - 员工 API
- `frontend/src/stores/auth.ts` - Zustand 认证 Store
- `frontend/src/components/guards/` - 4个 Guard 组件
- `frontend/src/layouts/AdminLayout.tsx` - 后台布局
- `frontend/src/pages/LoginPage.tsx` - 登录页
- `frontend/src/pages/PasswordChangePage.tsx` - 强制改密页
- `frontend/src/pages/NotFoundPage.tsx` - 404页
- `frontend/src/pages/NoPermissionPage.tsx` - 403页
- `frontend/src/pages/admin/DepartmentPage.tsx` - 部门管理页
- `frontend/src/pages/admin/EmployeePage.tsx` - 员工管理页
- `frontend/src/App.tsx` - 路由配置
- `frontend/src/main.tsx` - 入口文件

### 前端修改
- `frontend/vite.config.ts` - 添加路径别名和代理配置
- `frontend/tsconfig.app.json` - 添加路径别名和 ignoreDeprecations
- `frontend/src/index.css` - 全局样式重置

## 发现并解决的问题

1. **候选人查询排除逻辑**：初版只排除管理其他部门的人，需同时排除管理当前部门的人（已在候选人查询中修复）
2. **TypeScript 6 弃用 baseUrl**：需要在 tsconfig.app.json 中添加 `"ignoreDeprecations": "6.0"`
3. **Vite __dirname 弃用**：改用 `import.meta.dirname`
4. **未使用的变量**：EmployeePage 中 `handleSearch` 未使用，已删除

## AI 完成的工作

1. 新增12个业务错误码
2. 实现部门管理模块（DTO + Service + Controller）
3. 实现员工管理模块（DTO + Service + Controller）
4. 实现负责人管理（含事务、FOR UPDATE 锁、竞态防护）
5. 编写44项后端集成测试
6. 搭建前端认证基础设施（Axios、Zustand、Router、Guards）
7. 实现登录页和强制改密页
8. 实现后台管理布局
9. 实现部门管理前端页面
10. 实现员工管理前端页面
11. 修复候选人查询排除逻辑
12. 修复 TypeScript 6 兼容性问题

## 实际测试结果

```
✓ tests/auth.test.ts  (12 tests) 1531ms
✓ tests/day2.test.ts  (44 tests) 1098ms

 Test Files  2 passed (2)
      Tests  56 passed (56)
```

## 需要我理解的问题

1. 为什么部门负责人不是第三种基础角色？系统根据什么判断某人当前是负责人？
2. 为什么前端隐藏管理员按钮不能代替后端权限校验？
3. 更换负责人为什么需要事务？如果"检查待办"和"更新负责人"分开执行，可能发生什么？

## 明日计划

1. 公告模块（创建、编辑、发布、撤回、删除草稿）
2. 通讯录页面
3. 请假申请与审批流程
4. 工作概览

## 建议 Commit 范围

```
feat: Day 2 - 部门、员工与负责人管理

- 部门管理 CRUD (5 APIs)
- 员工管理 CRUD (7 APIs)
- 负责人管理 (4 APIs, 含事务+并发控制)
- 新增12个业务错误码
- 后端集成测试 44项 (总计56项)
- 前端认证基础设施 (Axios/Zustand/Router/Guards)
- 登录页、强制改密页、后台布局
- 部门管理前端页面
- 员工管理前端页面
- 前后端 build 通过
```
