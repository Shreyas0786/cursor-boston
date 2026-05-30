/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Shared GitHub REST/Search API helpers.
 *
 * The request-header builder was previously copy-pasted as `githubHeaders()` /
 * `searchHeaders()` / inline objects across five `github-*` modules, and the
 * search-pagination constants in two of them. Centralized here.
 */

/**
 * Standard GitHub API request headers. Adds a `Bearer` token from
 * `GITHUB_TOKEN` when present (raises the rate limit); anonymous otherwise.
 */
export function getGithubApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/** Max results per Search API page (GitHub's ceiling). */
export const GITHUB_SEARCH_PER_PAGE = 100;

/** GitHub Search returns at most the first 1000 matches (10 × 100). */
export const GITHUB_SEARCH_MAX_PAGES = 10;
