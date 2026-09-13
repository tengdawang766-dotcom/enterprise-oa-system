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
