import type { IPlayer, IEnemy, IBoss, IBullet, IPowerUp, IEffect, IBackgroundWithSpeed, ITerrain, ILevelManager } from '../types.ts';

export interface WorldState {
  background: IBackgroundWithSpeed | null;
  terrain: ITerrain | null;
  levelManager: ILevelManager | null;
  player: IPlayer | null;
  enemies: IEnemy[];
  boss: IBoss | null;
  bullets: IBullet[];
  powerups: IPowerUp[];
  effects: IEffect[];
}

export function tickGameplay(world: WorldState, dt: number): void {
  const { terrain, levelManager } = world;

  world.background?.update(dt);
  world.levelManager?.update(dt);

  // Terrain bounds — player and spaceship enemies clamp to walls
  if (terrain && levelManager) {
    terrain.update?.(levelManager.scrollX, dt);

    if (world.player) {
      const playerWorldX = levelManager.scrollX + world.player.x;
      world.player.terrainBounds = typeof terrain.getActualWallsAt === 'function'
        ? terrain.getActualWallsAt(playerWorldX)
        : terrain.getWallsAt(playerWorldX);
    }
  }

  // Player
  if (world.player) {
    for (const b of world.player.update(dt)) world.bullets.push(b);
  }

  // Enemies
  for (const enemy of world.enemies) {
    if (enemy.isSpaceShip && terrain && levelManager) {
      const enemyWorldX = levelManager.scrollX + enemy.x;
      enemy.terrainBounds = typeof terrain.getActualWallsAt === 'function'
        ? terrain.getActualWallsAt(enemyWorldX)
        : terrain.getWallsAt(enemyWorldX);
    }
    for (const b of enemy.update(dt)) world.bullets.push(b);
  }
  world.enemies = world.enemies.filter(enemy => {
    if (!enemy.isAlive || enemy.isOffscreen) { enemy.destroy(); return false; }
    return true;
  });

  // Boss
  if (world.boss) {
    for (const b of world.boss.update(dt)) world.bullets.push(b);
  }

  // Bullets
  for (const b of world.bullets) b.update(dt);
  world.bullets = world.bullets.filter(b => {
    if (b.isOffscreen || !b.active) { b.destroy(); return false; }
    return true;
  });

  // PowerUps
  for (const p of world.powerups) p.update(dt);
  world.powerups = world.powerups.filter(p => {
    if (p.isOffscreen) { p.destroy(); return false; }
    return true;
  });

  // Effects
  for (const e of world.effects) e.update(dt);
  world.effects = world.effects.filter(e => !e.isDone);

}
