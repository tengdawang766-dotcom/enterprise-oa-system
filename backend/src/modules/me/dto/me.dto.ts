import { z } from 'zod';

/**
 * PATCH /api/v1/me/contact
 * Only workEmail and phone can be modified by the user themselves.
 * Empty string is normalized to null. Whitespace is trimmed.
 */
export const updateContactSchema = z.object({
  workEmail: z
    .preprocess(
      (val) => {
        if (val === '' || val === null || val === undefined) return null;
        return typeof val === 'string' ? val.trim() : val;
      },
      z
        .string()
        .max(100, '工作邮箱最多 100 个字符')
        .email('邮箱格式不正确')
        .nullable()
    ),
  phone: z
    .preprocess(
      (val) => {
        if (val === '' || val === null || val === undefined) return null;
        return typeof val === 'string' ? val.trim() : val;
      },
      z
        .string()
        .max(30, '联系电话最多 30 个字符')
        .nullable()
    ),
});

export type UpdateContactRequest = z.infer<typeof updateContactSchema>;

/**
 * Strict schema that rejects any unknown fields.
 * Used to prevent callers from sneaking in disallowed fields (name, role, etc.)
 */
export const updateContactStrictSchema = updateContactSchema.strict();
