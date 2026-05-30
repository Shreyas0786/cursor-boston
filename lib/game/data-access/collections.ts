/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Canonical Firestore collection names + well-known doc ids for the game.
 *
 * `COLLECTIONS` was previously redeclared in three modules (data-server,
 * npc-weekly, armageddon-resolve) as overlapping subsets — a drift hazard. This
 * is the single source of truth (the union of all three); each importer aliases
 * it back to `COLLECTIONS` and references only the keys it needs.
 */
export const GAME_COLLECTIONS = {
  PLAYERS: "game_players",
  TILES: "game_tiles",
  ATTACKS: "game_attacks",
  WORLD_META: "game_world_meta",
  ARTIFACTS: "game_artifacts",
  // Intel effects: per-target debuffs/passives applied by spells, read inside
  // attack resolution.
  INTEL_EFFECTS: "game_intel_effects",
  // Community feed: append-only event log of player actions (joins, caste
  // picks, attacks, milestones). Read by the dashboard's CommunityPanel.
  // Writes are Admin-SDK only.
  COMMUNITY_EVENTS: "game_community_events",
  // Community chat: free-form messages from authenticated players, moderated by
  // author or by an admin (delete-only).
  COMMUNITY_MESSAGES: "game_community_messages",
  // End-game / Armageddon hall-of-fame: one doc per past Armageddon (doc id =
  // seasonNumber). Persisted before the wipe so the record survives even if the
  // resolver crashes mid-batch.
  ARMAGEDDON_EVENTS: "game_armageddon_events",
  // Zero-turn gameplay: queued battle plans that execute at next weekly grant.
  // Owned by player; writes Admin-SDK only.
  ORDER_QUEUE: "game_order_queue",
} as const;

/** The singleton world-meta document id. */
export const WORLD_META_DOC = "singleton";
