/**
 * Shared date/time formatting utilities.
 *
 * Strategy:
 * - Business dates (startDate, endDate): displayed as "YYYY-MM-DD"
 * - Timestamps (createdAt, publishedAt, etc.): displayed as locale string
 * - All API timestamps are ISO 8601 strings
 */

import dayjs from 'dayjs';

/** Format a date-only string ("YYYY-MM-DD") for display. No timezone conversion. */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  // If it's already YYYY-MM-DD, return as-is (no timezone conversion needed)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  // Otherwise parse and format
  return dayjs(dateStr).format('YYYY-MM-DD');
}

/** Format a timestamp (ISO 8601) as locale-aware date+time string. */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('YYYY-MM-DD HH:mm');
}

/** Format a timestamp as short date (MM-DD). */
export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  return dayjs(dateStr).format('MM-DD');
}
