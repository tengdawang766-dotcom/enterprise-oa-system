import { z } from 'zod';

// ---- Directory List Query ----
export const directoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  keyword: z.string().optional(),
  departmentId: z.coerce.number().int().positive().optional(),
});

export type DirectoryQuery = z.infer<typeof directoryQuerySchema>;
