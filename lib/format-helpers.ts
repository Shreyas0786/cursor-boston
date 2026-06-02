/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Canonical human-facing date formatters.
 *
 * Components previously inlined `toLocaleDateString` with five different
 * option sets (and two different locales). These two helpers are the
 * standardized formats; consolidating onto them deliberately unifies a few
 * call sites (e.g. long month-names → short, default locale → en-US) so dates
 * read consistently across the app.
 */

function toDate(value: Date | string | number): Date | null {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Mar 5, 2026" — short month, day, year. The default full-date format. */
export function formatShortDate(value: Date | string | number): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "Mar 2026" — short month + year, no day. For "member since" / "earned" lines. */
export function formatMonthYear(value: Date | string | number): string {
  const d = toDate(value);
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
