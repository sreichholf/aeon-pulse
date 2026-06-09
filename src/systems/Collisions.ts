import type { HitZone, ICollidable, TerrainBounds, IPlayer, IEnemy, IBoss, IBullet, IPowerUp } from '../types.ts';

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

interface CollisionState<
  TPlayer extends CollisionPlayerBody = IPlayer,
  TEnemy extends CollisionEnemyBody = IEnemy,
  TBoss extends CollisionBossBody = IBoss,
  TBullet extends CollisionBulletBody = IBullet,
  TPowerUp extends CollisionPowerUpBody = IPowerUp,
> {
  player: TPlayer | null;
  enemies: TEnemy[];
  boss: TBoss | null;
  bullets: TBullet[];
  powerups: TPowerUp[];
}

export enum CollisionContactKind {
  PLAYER_BULLET_ENEMY = 'player-bullet-enemy',
  PLAYER_BULLET_BOSS = 'player-bullet-boss',
  BOSS_LASER_PLAYER = 'boss-laser-player',
  PLAYER_TERRAIN = 'player-terrain',
  ENEMY_BULLET_PLAYER = 'enemy-bullet-player',
  ENEMY_RAM_PLAYER = 'enemy-ram-player',
  POWERUP_PLAYER = 'powerup-player',
}

export type CollisionContact<
  TPlayer extends CollisionPlayerBody = IPlayer,
  TEnemy extends CollisionEnemyBody = IEnemy,
  TBoss extends CollisionBossBody = IBoss,
  TBullet extends CollisionBulletBody = IBullet,
  TPowerUp extends CollisionPowerUpBody = IPowerUp,
> =
  | { kind: CollisionContactKind.PLAYER_BULLET_ENEMY; bullet: TBullet; enemy: TEnemy }
  | { kind: CollisionContactKind.PLAYER_BULLET_BOSS; bullet: TBullet; boss: TBoss; zone: HitZone }
  | { kind: CollisionContactKind.BOSS_LASER_PLAYER; laser: ICollidable; player: TPlayer }
  | { kind: CollisionContactKind.PLAYER_TERRAIN; player: TPlayer }
  | { kind: CollisionContactKind.ENEMY_BULLET_PLAYER; bullet: TBullet; player: TPlayer }
  | { kind: CollisionContactKind.ENEMY_RAM_PLAYER; enemy: TEnemy; player: TPlayer }
  | { kind: CollisionContactKind.POWERUP_PLAYER; powerup: TPowerUp; player: TPlayer };

function overlap(ax: number, ay: number, ahw: number, ahh: number, bx: number, by: number, bhw: number, bhh: number): boolean {
  return Math.abs(ax - bx) < ahw + bhw && Math.abs(ay - by) < ahh + bhh;
}

export function checkCollisions<
  TPlayer extends CollisionPlayerBody = IPlayer,
  TEnemy extends CollisionEnemyBody = IEnemy,
  TBoss extends CollisionBossBody = IBoss,
  TBullet extends CollisionBulletBody = IBullet,
  TPowerUp extends CollisionPowerUpBody = IPowerUp,
>(
  state: CollisionState<TPlayer, TEnemy, TBoss, TBullet, TPowerUp>,
  onContact: (contact: CollisionContact<TPlayer, TEnemy, TBoss, TBullet, TPowerUp>) => void,
): void {
  const { player, enemies, boss, bullets, powerups } = state;

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
  }

  // ── Boss lasers vs player (currently always empty — ready for future hitbox lasers) ──
  if (player && boss) {
    for (const laser of boss.lasers) {
      if (!overlap(player.x, player.y, player.hw, player.hh,
                   laser.x,  laser.y,  laser.hw,  laser.hh)) continue;
      onContact({ kind: CollisionContactKind.BOSS_LASER_PLAYER, laser, player });
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
