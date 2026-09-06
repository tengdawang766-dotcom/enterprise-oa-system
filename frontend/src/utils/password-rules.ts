import type { Rule } from 'antd/es/form';

/**
 * Shared password validation rules matching the backend:
 * - At least 8 characters
 * - Must contain at least one letter
 * - Must contain at least one digit
 *
 * Usage:
 *   <Form.Item name="password" rules={PASSWORD_RULES}>
 */
export const PASSWORD_RULES: Rule[] = [
  { required: true, message: '请输入密码' },
  { min: 8, message: '密码至少 8 位' },
  { pattern: /[a-zA-Z]/, message: '密码必须包含字母' },
  { pattern: /[0-9]/, message: '密码必须包含数字' },
];

/** Placeholder text for password input fields */
export const PASSWORD_PLACEHOLDER = '至少8位，包含字母和数字';
