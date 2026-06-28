import type { HitZone, ICollidable, TerrainBounds, IPlayer, IEnemy, IBoss, IBullet, IPowerUp, IProp, PropSolidBounds } from '../types.ts';
import { overlapsSolidProp } from './SolidPropPhysicality.ts';

interface CollisionPlayerBody extends ICollidable {
  readonly terrainBounds: TerrainBounds | null;
}

interface CollisionEnemyBody extends ICollidable {
  readonly isAlive: boolean;
}

interface CollisionBossBody {
  readonly isDying: boolean;
  hitZones(): HitZone[];
  readonly lasers: ReadonlyArray<ICollidable>;
}

interface CollisionBulletBody extends ICollidable {
  readonly active: boolean;
  readonly isPlayerBullet: boolean;
  readonly isPiercing: boolean;
}

type CollisionPowerUpBody = ICollidable;

interface CollisionPropBody extends ICollidable {
  readonly isAlive: boolean;
  readonly isSolid: boolean;
  getSolidBounds(): PropSolidBounds | null;
}

interface CollisionState<
  TPlayer extends CollisionPlayerBody = IPlayer,
  TEnemy extends CollisionEnemyBody = IEnemy,
  TBoss extends CollisionBossBody = IBoss,
  TBullet extends CollisionBulletBody = IBullet,
  TPowerUp extends CollisionPowerUpBody = IPowerUp,
  TProp extends CollisionPropBody = IProp,
> {
  player: TPlayer | null;
  enemies: TEnemy[];
  boss: TBoss | null;
  bullets: TBullet[];
  powerups: TPowerUp[];
  props: TProp[];
}

export enum CollisionContactKind {
  PLAYER_BULLET_ENEMY = 'player-bullet-enemy',
  PLAYER_BULLET_BOSS = 'player-bullet-boss',
  PLAYER_BULLET_PROP = 'player-bullet-prop',
  BOSS_LASER_PLAYER = 'boss-laser-player',
  PLAYER_TERRAIN = 'player-terrain',
  ENEMY_BULLET_PLAYER = 'enemy-bullet-player',
  ENEMY_RAM_PLAYER = 'enemy-ram-player',
  POWERUP_PLAYER = 'powerup-player',
  PLAYER_SOLID_PROP = 'player-solid-prop',
  ENEMY_BULLET_SOLID_PROP = 'enemy-bullet-solid-prop',
  ENEMY_SOLID_PROP = 'enemy-solid-prop',
}

export type CollisionContact<
  TPlayer extends CollisionPlayerBody = IPlayer,
  TEnemy extends CollisionEnemyBody = IEnemy,
  TBoss extends CollisionBossBody = IBoss,
  TBullet extends CollisionBulletBody = IBullet,
  TPowerUp extends CollisionPowerUpBody = IPowerUp,
  TProp extends CollisionPropBody = IProp,
> =
  | { kind: CollisionContactKind.PLAYER_BULLET_ENEMY; bullet: TBullet; enemy: TEnemy }
  | { kind: CollisionContactKind.PLAYER_BULLET_BOSS; bullet: TBullet; boss: TBoss; zone: HitZone }
  | { kind: CollisionContactKind.PLAYER_BULLET_PROP; bullet: TBullet; prop: TProp }
  | { kind: CollisionContactKind.BOSS_LASER_PLAYER; laser: ICollidable; player: TPlayer }
  | { kind: CollisionContactKind.PLAYER_TERRAIN; player: TPlayer }
  | { kind: CollisionContactKind.ENEMY_BULLET_PLAYER; bullet: TBullet; player: TPlayer }
  | { kind: CollisionContactKind.ENEMY_RAM_PLAYER; enemy: TEnemy; player: TPlayer }
  | { kind: CollisionContactKind.POWERUP_PLAYER; powerup: TPowerUp; player: TPlayer }
  | { kind: CollisionContactKind.PLAYER_SOLID_PROP; player: TPlayer; prop: TProp }
  | { kind: CollisionContactKind.ENEMY_BULLET_SOLID_PROP; bullet: TBullet; prop: TProp }
  | { kind: CollisionContactKind.ENEMY_SOLID_PROP; enemy: TEnemy; prop: TProp };

function overlap(ax: number, ay: number, ahw: number, ahh: number, bx: number, by: number, bhw: number, bhh: number): boolean {
  return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
}

export function checkCollisions<
  TPlayer extends CollisionPlayerBody = IPlayer,
  TEnemy extends CollisionEnemyBody = IEnemy,
  TBoss extends CollisionBossBody = IBoss,
  TBullet extends CollisionBulletBody = IBullet,
  TPowerUp extends CollisionPowerUpBody = IPowerUp,
  TProp extends CollisionPropBody = IProp,
>(
  state: CollisionState<TPlayer, TEnemy, TBoss, TBullet, TPowerUp, TProp>,
  onContact: (contact: CollisionContact<TPlayer, TEnemy, TBoss, TBullet, TPowerUp, TProp>) => void,
): void {
  const { player, enemies, boss, bullets, powerups, props } = state;

  // ── Player bullets vs enemies & boss ───────────────────────────────────────
  for (const bullet of bullets) {
    if (!bullet.active || !bullet.isPlayerBullet) continue;

    // vs enemies
    for (const enemy of enemies) {
      if (!enemy.isAlive) continue;
      if (!overlap(bullet.x, bullet.y, bullet.hw, bullet.hh,
                   enemy.x,  enemy.y,  enemy.hw,  enemy.hh)) continue;

      onContact({ kind: CollisionContactKind.PLAYER_BULLET_ENEMY, bullet, enemy });

      if (!bullet.isPiercing) {
        break; // non-piercing: done after first enemy contact
      }
    }

    // vs boss
    if (boss && !boss.isDying) {
      for (const zone of boss.hitZones()) {
        if (!overlap(bullet.x, bullet.y, bullet.hw, bullet.hh, zone.x, zone.y, zone.hw, zone.hh)) continue;
        onContact({ kind: CollisionContactKind.PLAYER_BULLET_BOSS, bullet, boss, zone });
        break;
      }
    }

    // vs props
    for (const prop of props) {
      if (!prop.isAlive) continue;
      let hitsProp = false;
      if (prop.isSolid) {
        const bounds = prop.getSolidBounds();
        hitsProp = bounds ? overlapsSolidProp(bounds, bullet) : false;
      } else {
        hitsProp = overlap(bullet.x, bullet.y, bullet.hw, bullet.hh, prop.x, prop.y, prop.hw, prop.hh);
      }
      if (!hitsProp) continue;
      onContact({ kind: CollisionContactKind.PLAYER_BULLET_PROP, bullet, prop });
      if (!bullet.isPiercing) break;
    }
  }

  // ── Boss lasers vs player (currently always empty — ready for future hitbox lasers) ──
  if (player && boss) {
    for (const laser of boss.lasers) {
      if (!overlap(player.x, player.y, player.hw, player.hh,
                   laser.x,  laser.y,  laser.hw,  laser.hh)) continue;
      onContact({ kind: CollisionContactKind.BOSS_LASER_PLAYER, laser, player });
    }
  }

  // ── Enemy bullets vs solid props (does not require a player) ───────────────
  for (const bullet of bullets) {
    if (!bullet.active || bullet.isPlayerBullet) continue;
    for (const prop of props) {
      if (!prop.isAlive || !prop.isSolid) continue;
      const bounds = prop.getSolidBounds();
      if (!bounds) continue;
      if (!overlapsSolidProp(bounds, bullet)) continue;
      onContact({ kind: CollisionContactKind.ENEMY_BULLET_SOLID_PROP, bullet, prop });
      break;
    }
  }

  // ── Enemies vs solid props (informational, for movement clamping)
  for (const enemy of enemies) {
    if (!enemy.isAlive) continue;
    for (const prop of props) {
      if (!prop.isAlive || !prop.isSolid) continue;
      const bounds = prop.getSolidBounds();
      if (!bounds) continue;
      if (!overlapsSolidProp(bounds, enemy)) continue;
      onContact({ kind: CollisionContactKind.ENEMY_SOLID_PROP, enemy, prop });
      break;
    }
  }

  if (!player) return;

  // ── Terrain walls vs player ────────────────────────────────────────────────
  if (player.terrainBounds !== null) {
    const { top, bottom } = player.terrainBounds;
    if (player.y + player.hh > top || player.y - player.hh < bottom) {
      onContact({ kind: CollisionContactKind.PLAYER_TERRAIN, player });
    }
  }

  // ── Solid props vs player ──────────────────────────────────────────────────
  for (const prop of props) {
    if (!prop.isAlive || !prop.isSolid) continue;
    const bounds = prop.getSolidBounds();
    if (!bounds) continue;
    if (!overlapsSolidProp(bounds, player)) continue;
    onContact({ kind: CollisionContactKind.PLAYER_SOLID_PROP, player, prop });
  }

  // ── Enemy bullets vs player ────────────────────────────────────────────────
  for (const bullet of bullets) {
    if (!bullet.active || bullet.isPlayerBullet) continue;
    if (!overlap(bullet.x, bullet.y, bullet.hw, bullet.hh,
                 player.x,  player.y,  player.hw,  player.hh)) continue;

    onContact({ kind: CollisionContactKind.ENEMY_BULLET_PLAYER, bullet, player });
  }

  // ── Enemies ramming player ─────────────────────────────────────────────────
  for (const enemy of enemies) {
    if (!enemy.isAlive) continue;
    if (!overlap(enemy.x, enemy.y, enemy.hw * 0.7, enemy.hh * 0.7,
                 player.x, player.y, player.hw,    player.hh)) continue;

    onContact({ kind: CollisionContactKind.ENEMY_RAM_PLAYER, enemy, player });
  }

  // ── PowerUps vs player ─────────────────────────────────────────────────────
  for (const pu of [...powerups]) {
    if (!overlap(pu.x, pu.y, pu.hw, pu.hh, player.x, player.y, player.hw, player.hh)) continue;
    onContact({ kind: CollisionContactKind.POWERUP_PLAYER, powerup: pu, player });
  }
}
