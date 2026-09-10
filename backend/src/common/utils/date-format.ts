/**
 * Date formatting utilities for consistent API responses.
 *
 * Strategy:
 * - Business dates (startDate, endDate): return "YYYY-MM-DD" string
 * - Timestamps (createdAt, publishedAt, etc.): return ISO 8601 string
 * - All times stored as UTC in the database
 */

/**
 * Format a Date object as "YYYY-MM-DD" for calendar/business dates.
 * Used for leave startDate/endDate which are @db.Date columns.
 */
export function formatDateOnly(date: Date | null | undefined): string | null {
  if (!date) return null;
  // Use UTC methods to avoid timezone shift — these are DATE columns (no time)
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Format a Date as ISO 8601 string for timestamps.
 * Used for createdAt, publishedAt, firstReadAt, etc.
 */
export function formatTimestamp(date: Date | null | undefined): string | null {
  if (!date) return null;
  return date.toISOString();
}
