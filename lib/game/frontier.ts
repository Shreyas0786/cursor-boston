/**
 * SPDX-License-Identifier: GPL-3.0-only
 * Copyright (C) 2026 Cursor Boston
 * This file is part of Cursor Boston, licensed under GPL-3.0.
 * See LICENSE file for details.
 */

/**
 * Frontier-tile selection for the play-phase explore action.
 *
 * Pure-ish candidate pickers extracted from data-server.ts: they read tiles
 * through the injected `db` handle but hold no transaction or write state, so
 * they live independently of the explore orchestrator (`frontierExploreServer`,
 * which stays in data-server and calls `pickFrontierCandidate`).
 */
import type { Firestore } from "firebase-admin/firestore";
import { type AxialCoord, neighbors as axialNeighbors, tileIdFromAxial } from "./world-gen";
import {
  type FrontierSample,
  distanceToNearestOwned,
  hexCentroid,
  kingdomRadiusFromCentroid,
  ringCoords,
  riskScore,
} from "./exploration";
import { GAME_COLLECTIONS as COLLECTIONS } from "./data-access/collections";

// Maximum hex rings to scan when looking for an unclaimed frontier tile.
// At our spacing this is roomy. If still nothing, refund the turn.
export const FRONTIER_MAX_RINGS = 12;

// After this many tiles ever claimed via explore (v1 setup + v2 frontier
// combined), the candidate picker switches from "ring-walk outward from the
// owned-centroid" (which tightly globs new claims onto existing territory)
// to a Monte Carlo sampler whose radius grows with each additional explore.
// Pre-threshold keeps the random-then-glob feel of the early game; past it,
// drops scatter further afield until they eventually reach other kingdoms.
export const EXPLORE_MONTE_CARLO_THRESHOLD = 150;
// Random samples to try before falling back to a deterministic ring walk.
export const MONTE_CARLO_MAX_SAMPLES = 24;

// Look up the owner of each of `coord`'s 6 neighbors and count those owned
// by anyone other than `userId`. One batched getAll.
async function countHostileNeighbors(
  db: Firestore,
  coord: AxialCoord,
  userId: string
): Promise<number> {
  const ns = axialNeighbors(coord.q, coord.r);
  const refs = ns.map((n) =>
    db.collection(COLLECTIONS.TILES).doc(tileIdFromAxial(n.q, n.r))
  );
  const snaps = await db.getAll(...refs);
  let hostileCount = 0;
  for (const ns of snaps) {
    if (!ns.exists) continue;
    const data = ns.data();
    if (data && data.ownerId && data.ownerId !== userId) hostileCount++;
  }
  return hostileCount;
}

async function buildFrontierSample(
  db: Firestore,
  userId: string,
  coord: AxialCoord,
  ownedTileIds: ReadonlyArray<string>
): Promise<FrontierSample> {
  const tileId = tileIdFromAxial(coord.q, coord.r);
  const hostileCount = await countHostileNeighbors(db, coord, userId);
  const distance = distanceToNearestOwned(coord, [...ownedTileIds]);
  const distanceFinite = Number.isFinite(distance) ? distance : 0;
  return {
    tile: coord,
    tileId,
    distanceToCore: distanceFinite,
    hostileNeighbors: hostileCount,
    riskScore: riskScore({
      hostileNeighbors: hostileCount,
      distanceToCore: distanceFinite,
    }),
  };
}

/**
 * Pick an unclaimed tile coord and return a FrontierSample describing it
 * (distance, hostile-neighbor count, risk).
 *
 * Two-phase behavior:
 *   - tilesExplored < EXPLORE_MONTE_CARLO_THRESHOLD: walk hex rings outward
 *     from the owned-centroid (existing behavior). Drops cluster onto the
 *     player's territory, naturally globbing into a contiguous kingdom.
 *   - tilesExplored >= EXPLORE_MONTE_CARLO_THRESHOLD: Monte Carlo sample
 *     within a radius that grows by +1 per explore past the threshold,
 *     anchored on the centroid. Drops scatter outward and eventually reach
 *     other kingdoms. Falls back to a ring walk over the same radius if too
 *     many random picks collide with claimed tiles.
 *
 * The pre-fetch happens outside the transaction; the caller re-validates the
 * pick is still unclaimed inside the transaction.
 */
export async function pickFrontierCandidate(
  db: Firestore,
  userId: string,
  ownedTileIds: ReadonlyArray<string>,
  tilesHeld: number,
  tilesExplored: number,
  rng: () => number
): Promise<FrontierSample | null> {
  const center = hexCentroid([...ownedTileIds]);

  if (tilesExplored < EXPLORE_MONTE_CARLO_THRESHOLD) {
    const minRing = Math.max(1, 1 + Math.floor(tilesHeld / 40));
    return await pickByRingWalk(
      db,
      userId,
      ownedTileIds,
      center,
      minRing,
      FRONTIER_MAX_RINGS,
      rng
    );
  }

  const kingdomRadius = kingdomRadiusFromCentroid(center, ownedTileIds);
  const extra = tilesExplored - EXPLORE_MONTE_CARLO_THRESHOLD;
  // +1 keeps us at least one ring outside the current blob even at threshold.
  const maxRadius = kingdomRadius + extra + 1;

  for (let i = 0; i < MONTE_CARLO_MAX_SAMPLES; i++) {
    const r = 1 + Math.floor(rng() * maxRadius);
    const ring = ringCoords(center, r);
    if (ring.length === 0) continue;
    const c = ring[Math.floor(rng() * ring.length)];
    const tileId = tileIdFromAxial(c.q, c.r);
    const snap = await db.collection(COLLECTIONS.TILES).doc(tileId).get();
    if (!snap.exists) {
      return await buildFrontierSample(db, userId, c, ownedTileIds);
    }
  }

  // Fallback: deterministic ring walk over the same radius range. Ensures we
  // return *something* if random samples all happened to hit claimed tiles.
  return await pickByRingWalk(
    db,
    userId,
    ownedTileIds,
    center,
    1,
    maxRadius,
    rng
  );
}

async function pickByRingWalk(
  db: Firestore,
  userId: string,
  ownedTileIds: ReadonlyArray<string>,
  center: AxialCoord,
  minRing: number,
  maxRing: number,
  rng: () => number
): Promise<FrontierSample | null> {
  for (let r = minRing; r <= maxRing; r++) {
    const coords = ringCoords(center, r);
    for (let i = coords.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [coords[i], coords[j]] = [coords[j], coords[i]];
    }
    if (coords.length === 0) continue;

    const refs = coords.map((c) =>
      db.collection(COLLECTIONS.TILES).doc(tileIdFromAxial(c.q, c.r))
    );
    const snaps = await db.getAll(...refs);

    for (let i = 0; i < snaps.length; i++) {
      if (snaps[i].exists) continue;
      return await buildFrontierSample(
        db,
        userId,
        coords[i],
        ownedTileIds
      );
    }
  }
  return null;
}
