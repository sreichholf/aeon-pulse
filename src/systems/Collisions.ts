import type { IPlayer, IEnemy, IBoss, IBullet, IPowerUp } from '../types.ts';

interface CollisionState {
  player: IPlayer | null;
  enemies: IEnemy[];
  boss: IBoss | null;
  bullets: IBullet[];
  powerups: IPowerUp[];
}

export enum HitEventKind {
  ENEMY_KILLED = 'enemy-killed',
  BOSS_HIT = 'boss-hit',
  PLAYER_HIT = 'player-hit',
  POWERUP_COLLECTED = 'powerup-collected',
}

export enum HitCause {
  BULLET = 'bullet',
  TERRAIN = 'terrain',
  RAM = 'ram',
  LASER = 'laser',
}

export type HitEvent =
  | { kind: HitEventKind.ENEMY_KILLED; x: number; y: number; score: number; dropPowerup: boolean }
  | { kind: HitEventKind.BOSS_HIT; x: number; y: number }
  | { kind: HitEventKind.PLAYER_HIT; cause: HitCause; x: number; y: number }
  | { kind: HitEventKind.POWERUP_COLLECTED; powerup: IPowerUp };

function overlap(ax: number, ay: number, ahw: number, ahh: number, bx: number, by: number, bhw: number, bhh: number): boolean {
  return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
}

export function checkCollisions(state: CollisionState, onHit: (e: HitEvent) => void): void {
  const { player, enemies, boss, bullets, powerups } = state;

  // ── Player bullets vs enemies & boss ───────────────────────────────────────
  for (const bullet of bullets) {
    if (!bullet.active || !bullet.isPlayerBullet) continue;

    // vs enemies
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      if (!overlap(bullet.x, bullet.y, bullet.hw, bullet.hh,
                   enemy.x,  enemy.y,  enemy.hw,  enemy.hh)) continue;

      const death = enemy.hit(bullet.damage);
      if (!bullet.isPiercing) bullet.active = false;

      if (death) {
        onHit({ kind: HitEventKind.ENEMY_KILLED, x: death.x, y: death.y, score: enemy.score, dropPowerup: death.dropPowerup });
      }

      if (!bullet.active) break; // non-piercing: done after first hit
    }

    // vs boss
    if (bullet.active && boss && !boss.isDying) {
      for (const zone of boss.hitZones()) {
        if (!overlap(bullet.x, bullet.y, bullet.hw, bullet.hh, zone.x, zone.y, zone.hw, zone.hh)) continue;
        boss.hit(bullet.damage, zone.id);
        if (!bullet.isPiercing) bullet.active = false;
        onHit({ kind: HitEventKind.BOSS_HIT, x: bullet.x, y: bullet.y });
        break;
      }
    }
  }

  // ── Boss lasers vs player (currently always empty — ready for future hitbox lasers) ──
  if (player && boss) {
    for (const laser of boss.lasers) {
      if (!overlap(player.x, player.y, player.hw, player.hh,
                   laser.x,  laser.y,  laser.hw,  laser.hh)) continue;
      if (player.hit()) {
        onHit({ kind: HitEventKind.PLAYER_HIT, cause: HitCause.LASER, x: player.x, y: player.y });
      }
    }
  }

  if (!player) return;

  // ── Terrain walls vs player ────────────────────────────────────────────────
  if (player.terrainBounds !== null) {
    const { top, bottom } = player.terrainBounds;
    if (player.y + player.hh > top || player.y - player.hh < bottom) {
      if (player.hit()) {
        onHit({ kind: HitEventKind.PLAYER_HIT, cause: HitCause.TERRAIN, x: player.x, y: player.y });
      }
    }
  }

  // ── Enemy bullets vs player ────────────────────────────────────────────────
  for (const bullet of bullets) {
    if (!bullet.active || bullet.isPlayerBullet) continue;
    if (!overlap(bullet.x, bullet.y, bullet.hw, bullet.hh,
                 player.x,  player.y,  player.hw,  player.hh)) continue;

    if (player.hit()) {
      onHit({ kind: HitEventKind.PLAYER_HIT, cause: HitCause.BULLET, x: player.x, y: player.y });
    }
    bullet.active = false;
  }

  // ── Enemies ramming player ─────────────────────────────────────────────────
  for (const enemy of enemies) {
    if (!enemy.isAlive) continue;
    if (!overlap(enemy.x, enemy.y, enemy.hw * 0.7, enemy.hh * 0.7,
                 player.x, player.y, player.hw,    player.hh)) continue;

    if (player.hit()) {
      onHit({ kind: HitEventKind.PLAYER_HIT, cause: HitCause.RAM, x: player.x, y: player.y });
    }
    const death = enemy.hit(999);
    if (death) {
      // score: 0 — rams are a punishment, no points awarded
      onHit({ kind: HitEventKind.ENEMY_KILLED, x: death.x, y: death.y, score: 0, dropPowerup: death.dropPowerup });
    }
  }

  // ── PowerUps vs player ─────────────────────────────────────────────────────
  for (const pu of [...powerups]) {
    if (!overlap(pu.x, pu.y, pu.hw, pu.hh, player.x, player.y, player.hw, player.hh)) continue;
    onHit({ kind: HitEventKind.POWERUP_COLLECTED, powerup: pu });
  }
}
