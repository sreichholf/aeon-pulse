import type { IPlayer, IEnemy, IBoss, IBullet, IPowerUp, IEffect, IBackgroundWithSpeed, ITerrain, ILevelManager } from '../types.ts';
import { measurePerfPhase } from './PerfProbe.ts';

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
  destroyOrReleaseBullet?: (bullet: IBullet) => void;
}

export function tickGameplay(world: WorldState, dt: number): void {
  const { terrain, levelManager } = world;

  measurePerfPhase('tick.background', () => world.background?.update(dt));
  measurePerfPhase('tick.levelManager', () => world.levelManager?.update(dt));

  // Terrain bounds — player and spaceship enemies clamp to walls
  if (terrain && levelManager) {
    measurePerfPhase('tick.terrain.update', () => terrain.update?.(levelManager.scrollX, dt));

    if (world.player) {
      const playerWorldX = levelManager.scrollX + world.player.x;
      measurePerfPhase('tick.terrain.playerBounds', () => {
        world.player!.terrainBounds = terrain.getActualWallsAt(playerWorldX);
      });
    }
  }

  // Player
  if (world.player) {
    measurePerfPhase('tick.player', () => {
      for (const b of world.player!.update(dt)) world.bullets.push(b);
    });
  }

  // Enemies
  measurePerfPhase('tick.enemies', () => {
    for (const enemy of world.enemies) {
      if (enemy.isSpaceShip && terrain && levelManager) {
        const enemyWorldX = levelManager.scrollX + enemy.x;
        enemy.terrainBounds = terrain.getActualWallsAt(enemyWorldX);
      }
      for (const b of enemy.update(dt)) world.bullets.push(b);
    }
    world.enemies = world.enemies.filter(enemy => {
      if (!enemy.isAlive || enemy.isOffscreen) { enemy.destroy(); return false; }
      return true;
    });
  });

  // Boss
  if (world.boss) {
    measurePerfPhase('tick.boss', () => {
      for (const b of world.boss!.update(dt)) world.bullets.push(b);
    });
  }

  // Bullets
  measurePerfPhase('tick.bullets', () => {
    for (const b of world.bullets) b.update(dt);
    world.bullets = world.bullets.filter(b => {
      if (b.isOffscreen || !b.active) {
        if (world.destroyOrReleaseBullet) {
          world.destroyOrReleaseBullet(b);
        } else {
          b.destroy();
        }
        return false;
      }
      return true;
    });
  });

  // PowerUps
  measurePerfPhase('tick.powerups', () => {
    for (const p of world.powerups) p.update(dt);
    world.powerups = world.powerups.filter(p => {
      if (p.isOffscreen) { p.destroy(); return false; }
      return true;
    });
  });

  // Effects
  measurePerfPhase('tick.effects', () => {
    for (const e of world.effects) e.update(dt);
    world.effects = world.effects.filter(e => !e.isDone);
  });

}
