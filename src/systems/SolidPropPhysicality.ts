import { GAME_HEIGHT, GAME_WIDTH } from '../constants.ts';
import type { ICollidable, IPlayer, PlayfieldBounds, PropSolidBounds } from '../types.ts';
import { PropCollisionShape } from '../types.ts';

export interface SolidPropPlacementLike {
  readonly propType: string;
  readonly isFullGate: boolean;
  readonly x: number;
  readonly y: number;
  readonly hw: number;
  readonly hh: number;
  getSolidBounds(): PropSolidBounds | null;
}

export function overlapsSolidProp(bounds: PropSolidBounds, other: ICollidable): boolean {
  if (bounds.shape === PropCollisionShape.BOX) {
    return (
      Math.abs(bounds.x - other.x) < bounds.hw + other.hw &&
      Math.abs(bounds.y - other.y) < bounds.hh + other.hh
    );
  }

  const closestX = Math.max(other.x - other.hw, Math.min(bounds.x, other.x + other.hw));
  const closestY = Math.max(other.y - other.hh, Math.min(bounds.y, other.y + other.hh));
  const dx = bounds.x - closestX;
  const dy = bounds.y - closestY;
  return dx * dx + dy * dy < bounds.radius * bounds.radius;
}

export function resolveSolidPropBodyPosition(
  bounds: PropSolidBounds,
  body: ICollidable,
  playfieldBounds?: PlayfieldBounds | null,
): { x: number; y: number } {
  let nextX = body.x;
  let nextY = body.y;

  if (bounds.shape === PropCollisionShape.CIRCLE) {
    const dx = body.x - bounds.x;
    const dy = body.y - bounds.y;
    const dist = Math.hypot(dx, dy) || 1;
    const target = bounds.radius + Math.max(body.hw, body.hh) + 0.5;
    nextX = bounds.x + (dx / dist) * target;
    nextY = bounds.y + (dy / dist) * target;
  } else {
    const dx = body.x - bounds.x;
    const dy = body.y - bounds.y;
    const overlapX = bounds.hw + body.hw - Math.abs(dx);
    const overlapY = bounds.hh + body.hh - Math.abs(dy);
    if (overlapX > 0 && overlapY > 0) {
      if (overlapX < overlapY) {
        nextX = bounds.x + (dx >= 0 ? 1 : -1) * (bounds.hw + body.hw + 0.5);
      } else {
        nextY = bounds.y + (dy >= 0 ? 1 : -1) * (bounds.hh + body.hh + 0.5);
      }
    }
  }

  return clampPositionToPlayfield(nextX, nextY, body.hw, body.hh, playfieldBounds);
}

export function displaceSpawnYFromSolidProps(
  x: number,
  y: number,
  hw: number,
  hh: number,
  solidBounds: readonly PropSolidBounds[],
  corridorBounds?: PlayfieldBounds | null,
): number {
  let result = y;
  for (const bounds of solidBounds) {
    if (!overlapsSolidProp(bounds, { x, y: result, hw, hh })) continue;
    result = resolveSolidPropBodyPosition(bounds, { x, y: result, hw, hh }).y;
  }

  if (corridorBounds) {
    result = Math.max(corridorBounds.bottom + hh, Math.min(corridorBounds.top - hh, result));
  }
  return result;
}

export function validateSolidPropPlacement(
  prop: SolidPropPlacementLike,
  rightEdgeLimitX: number,
  corridorBounds?: PlayfieldBounds | null,
): string[] {
  const bounds = prop.getSolidBounds();
  if (!bounds) return [];

  const issues: string[] = [];
  if (prop.x > rightEdgeLimitX) {
    issues.push(
      `Solid prop ${prop.propType} spawned too close to the right playfield edge (x=${prop.x}); minimum buffer is x <= ${rightEdgeLimitX}`,
    );
  }

  if (!corridorBounds) return issues;

  const top = bounds.y + (bounds.shape === PropCollisionShape.CIRCLE ? bounds.radius : bounds.hh);
  const bottom = bounds.y - (bounds.shape === PropCollisionShape.CIRCLE ? bounds.radius : bounds.hh);

  if (top > corridorBounds.top + 0.001 || bottom < corridorBounds.bottom - 0.001) {
    issues.push(
      `Solid prop ${prop.propType} overlaps the corridor walls at x=${prop.x} ` +
        `(prop top=${top} bottom=${bottom}, corridor top=${corridorBounds.top} bottom=${corridorBounds.bottom})`,
    );
  }

  if (!prop.isFullGate && top >= corridorBounds.top - 0.001 && bottom <= corridorBounds.bottom + 0.001) {
    issues.push(`Solid prop ${prop.propType} blocks the full corridor at x=${prop.x} but is not flagged as fullGate`);
  }

  return issues;
}

function clampPositionToPlayfield(
  x: number,
  y: number,
  hw: number,
  hh: number,
  playfieldBounds?: PlayfieldBounds | null,
): { x: number; y: number } {
  const halfW = GAME_WIDTH / 2;
  const defaultTop = GAME_HEIGHT / 2;
  const defaultBottom = -GAME_HEIGHT / 2;
  const top = playfieldBounds?.top ?? defaultTop;
  const bottom = playfieldBounds?.bottom ?? defaultBottom;

  return {
    x: Math.max(-halfW + hw, Math.min(halfW - hw, x)),
    y: Math.max(bottom + hh, Math.min(top - hh, y)),
  };
}

export function pushPlayerOutOfSolidProp(
  player: IPlayer,
  bounds: PropSolidBounds,
  playfieldBounds?: PlayfieldBounds | null,
): void {
  const next = resolveSolidPropBodyPosition(bounds, player, playfieldBounds);
  player.setPosition(next.x, next.y);
}
