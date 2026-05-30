/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Read-only game queries (player / tiles / map projections / owner summaries),
 * extracted from data-server. These are dependency-injected reads with no
 * transaction state — they read through `adminDbOrThrow()` and apply lazy
 * BASE-regen on the way out. data-server re-exports them so existing
 * `@/lib/game/data-server` import sites are unaffected.
 */
import { isShieldActive } from "../turns";
import { neighborTileIds } from "../world-gen";
import type { Caste, GamePlayer, GameTile, MapTile } from "../types";
import { GAME_COLLECTIONS as COLLECTIONS } from "./collections";
import { adminDbOrThrow } from "./db";
import { applyLazyRegen, applyLazyRegenBatch } from "./tile-regen";

export async function getPlayerServer(
  userId: string
): Promise<GamePlayer | null> {
  const db = adminDbOrThrow();
  const snap = await db.collection(COLLECTIONS.PLAYERS).doc(userId).get();
  return snap.exists ? (snap.data() as GamePlayer) : null;
}

/** @internal */
export async function getOwnedTilesServer(userId: string): Promise<GameTile[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", userId)
    .get();
  const playerSnap = await db.collection(COLLECTIONS.PLAYERS).doc(userId).get();
  const player = playerSnap.exists ? (playerSnap.data() as GamePlayer) : null;
  const tiles = snap.docs.map((d) => d.data() as GameTile);
  return applyLazyRegenBatch(tiles, player, new Date());
}

// Lightweight tile fetch — uses Firestore's select() to only pull the fields
// the map/dashboard need. Same Firestore read cost (Firestore charges per
// doc, not per field), but ~60-70% smaller wire payload and JSON parse cost.
// For a 200-tile player this drops the response from ~200KB to ~70KB.
export async function getOwnedMapTilesServer(
  userId: string
): Promise<MapTile[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.TILES)
    .where("ownerId", "==", userId)
    .select(
      "tileId",
      "q",
      "r",
      "type",
      "ownerId",
      "units",
      "baseUnits",
      "armedDefenseSpellId",
      "hero"
    )
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      tileId: data.tileId,
      q: data.q,
      r: data.r,
      type: data.type,
      ownerId: data.ownerId ?? null,
      units: data.units,
      baseUnits: data.baseUnits ?? { ground: 0, siege: 0, air: 0 },
      armedDefenseSpellId: data.armedDefenseSpellId ?? null,
      ...(data.hero ? { hero: data.hero } : {}),
    } as MapTile;
  });
}

// Global map view. Returns every tile in the world with the lightweight
// MapTile projection. The whole world today is ~500 tiles (one batch); if it
// grows beyond a few thousand, callers should switch to
// `getMapTilesInBoundsServer` (viewport bounding-box).
export async function getAllMapTilesServer(): Promise<MapTile[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.TILES)
    .select(
      "tileId",
      "q",
      "r",
      "type",
      "ownerId",
      "units",
      "baseUnits",
      "armedDefenseSpellId",
      "hero"
    )
    .get();
  return snap.docs.map((d) => {
    const data = d.data();
    return {
      tileId: data.tileId,
      q: data.q,
      r: data.r,
      type: data.type,
      ownerId: data.ownerId ?? null,
      units: data.units,
      baseUnits: data.baseUnits ?? { ground: 0, siege: 0, air: 0 },
      armedDefenseSpellId: data.armedDefenseSpellId ?? null,
      ...(data.hero ? { hero: data.hero } : {}),
    } as MapTile;
  });
}

// Hard cap on the number of tiles a viewport bbox query may return. Keeps a
// runaway zoomed-out fetch from accidentally pulling the whole world.
const VIEWPORT_TILE_LIMIT = 5000;

// Viewport-bounded version of getAllMapTilesServer. Single-field range query
// on `q` (no composite index needed) plus an in-memory `r` filter — Firestore
// only allows one inequality field per query in this style.
//
// At our hex spacing (~500 tiles per world today), the in-memory `r` filter
// scans the full q-band; for a roughly square world this is approximately
// the bbox area. For larger worlds add a composite index on (q ASC, r ASC)
// and switch to two-field range; at 500 tiles the simple form is fine.
export async function getMapTilesInBoundsServer(bounds: {
  qMin: number;
  qMax: number;
  rMin: number;
  rMax: number;
}): Promise<MapTile[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.TILES)
    .where("q", ">=", bounds.qMin)
    .where("q", "<=", bounds.qMax)
    .select(
      "tileId",
      "q",
      "r",
      "type",
      "ownerId",
      "units",
      "baseUnits",
      "armedDefenseSpellId",
      "hero"
    )
    .limit(VIEWPORT_TILE_LIMIT + 1)
    .get();
  if (snap.size > VIEWPORT_TILE_LIMIT) {
    throw new Error(
      `getMapTilesInBoundsServer: bbox returned more than ${VIEWPORT_TILE_LIMIT} tiles; narrow the range`
    );
  }
  const out: MapTile[] = [];
  for (const d of snap.docs) {
    const data = d.data();
    if (typeof data.r !== "number") continue;
    if (data.r < bounds.rMin || data.r > bounds.rMax) continue;
    out.push({
      tileId: data.tileId,
      q: data.q,
      r: data.r,
      type: data.type,
      ownerId: data.ownerId ?? null,
      units: data.units,
      baseUnits: data.baseUnits ?? { ground: 0, siege: 0, air: 0 },
      armedDefenseSpellId: data.armedDefenseSpellId ?? null,
      ...(data.hero ? { hero: data.hero } : {}),
    } as MapTile);
  }
  return out;
}

/** @internal */
export interface OwnerSummary {
  userId: string;
  displayName: string;
  caste: Caste | null;
  shielded: boolean;
  /** True when this player is a seeded NPC. Real humans have the field
   *  unset on their player doc; we surface explicit `false` for them so
   *  client-side filters can rely on the boolean. */
  isNpc: boolean;
}

// Personal map view: my tiles + the *enemy* tiles that share an edge with
// any of my tiles + owner summaries for those enemies. Designed to be the
// default fetch for /game/tiles, /game/spells, /game/recruit — the rest of
// the world isn't relevant to those pages.
//
// Read cost: 1 query (own tiles) + 1 batched docRef.getAll() for the
// border ring + 1 batched docRef.getAll() for owner summaries. For a
// 25-tile spawn cluster: ~25 + ~30 + ~5 = ~60 reads (vs ~500 for the
// full-world fetch). Scales with kingdom perimeter, not world size.
/** @internal */
export interface MyMapView {
  myTiles: MapTile[];
  borderTiles: MapTile[];
  owners: OwnerSummary[];
}

export async function getMyMapServer(
  userId: string,
  now: Date = new Date()
): Promise<MyMapView> {
  const db = adminDbOrThrow();
  const myTiles = await getOwnedMapTilesServer(userId);
  if (myTiles.length === 0) {
    return { myTiles: [], borderTiles: [], owners: [] };
  }

  // Build the set of neighbor tile ids that are NOT mine.
  const myIds = new Set(myTiles.map((t) => t.tileId));
  const neighborIds = new Set<string>();
  for (const t of myTiles) {
    for (const id of neighborTileIds(t.q, t.r)) {
      if (!myIds.has(id)) neighborIds.add(id);
    }
  }

  // Batch-fetch the border ring. We could pre-filter to only-existent docs,
  // but db.getAll handles missing docs cheaply (returns non-existent
  // snapshots) so a single round-trip is fine.
  const borderTiles: MapTile[] = [];
  const enemyOwnerIds = new Set<string>();
  if (neighborIds.size > 0) {
    const refs = [...neighborIds].map((id) =>
      db.collection(COLLECTIONS.TILES).doc(id)
    );
    const snaps = await db.getAll(...refs);
    for (const s of snaps) {
      if (!s.exists) continue;
      const data = s.data()!;
      // Per spec: only enemy tiles. Skip unowned and self-owned border
      // tiles entirely. Unowned-but-revealed neighbors don't load —
      // there's no enemy presence there to display.
      if (!data.ownerId || data.ownerId === userId) continue;
      borderTiles.push({
        tileId: data.tileId,
        q: data.q,
        r: data.r,
        type: data.type,
        ownerId: data.ownerId,
        units: data.units,
        baseUnits: data.baseUnits ?? { ground: 0, siege: 0, air: 0 },
        armedDefenseSpellId: data.armedDefenseSpellId ?? null,
      });
      enemyOwnerIds.add(data.ownerId);
    }
  }

  // Owner summaries for the enemies on our border.
  const owners: OwnerSummary[] = [];
  if (enemyOwnerIds.size > 0) {
    const ownerRefs = [...enemyOwnerIds].map((uid) =>
      db.collection(COLLECTIONS.PLAYERS).doc(uid)
    );
    const ownerSnaps = await db.getAll(...ownerRefs);
    for (const s of ownerSnaps) {
      if (!s.exists) continue;
      const p = s.data() as GamePlayer;
      owners.push({
        userId: p.userId,
        displayName: p.displayName ?? "",
        caste: p.caste ?? null,
        shielded: isShieldActive(p, now),
        isNpc: (p as { isNpc?: boolean }).isNpc === true,
      });
    }
  }

  return { myTiles, borderTiles, owners };
}

// Owner-side metadata for the global map: name, caste, shield status. One
// record per player; the client joins it onto tiles by ownerId.
export async function getAllOwnerSummariesServer(
  now: Date = new Date()
): Promise<OwnerSummary[]> {
  const db = adminDbOrThrow();
  const snap = await db
    .collection(COLLECTIONS.PLAYERS)
    .select(
      "userId",
      "displayName",
      "caste",
      "shieldUntil",
      "shieldDropAtTurn",
      "turnsSpentTotal",
      "isNpc"
    )
    .get();
  return snap.docs.map((d) => {
    const data = d.data() as GamePlayer & { isNpc?: boolean };
    return {
      userId: data.userId,
      displayName: data.displayName ?? "",
      caste: data.caste ?? null,
      shielded: isShieldActive(data, now),
      isNpc: data.isNpc === true,
    };
  });
}

export async function getTileServer(tileId: string): Promise<GameTile | null> {
  const db = adminDbOrThrow();
  const snap = await db.collection(COLLECTIONS.TILES).doc(tileId).get();
  if (!snap.exists) return null;
  const tile = snap.data() as GameTile;
  if (!tile.ownerId) return tile;
  const playerSnap = await db
    .collection(COLLECTIONS.PLAYERS)
    .doc(tile.ownerId)
    .get();
  const player = playerSnap.exists ? (playerSnap.data() as GamePlayer) : null;
  return applyLazyRegen(tile, player, new Date(), db);
}
