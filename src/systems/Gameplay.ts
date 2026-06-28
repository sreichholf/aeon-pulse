import type { IPlayer, IEnemy, IBoss, IBullet, IPowerUp, IEffect, IBackgroundWithSpeed, ITerrain, ILevelManager, IProp, TerrainBounds } from '../types.ts';
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
  props: IProp[];
  playfieldMargins?: { top: number; bottom: number } | null;
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
        const walls = terrain.getCollisionWallsAt(playerWorldX);
        world.player!.terrainBounds = applyMargins(walls, world.playfieldMargins);
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
        enemy.terrainBounds = applyMargins(terrain.getCollisionWallsAt(enemyWorldX), world.playfieldMargins);
      }
      for (const b of enemy.update(dt)) world.bullets.push(b);
    }

    // Boss update runs before the enemy filter so that enemies spawned by the
    // boss (e.g. Stalactites, Rock Drakes) are present in world.enemies when
    // the filter runs. Otherwise they are pushed to the stale this._enemies
    // array and orphaned — visible in the scene but never ticked or destroyed.
    if (world.boss) {
      measurePerfPhase('tick.boss', () => {
        for (const b of world.boss!.update(dt)) world.bullets.push(b);
      });
    }

    world.enemies = world.enemies.filter(enemy => {
      if (!enemy.isAlive || enemy.isOffscreen) { enemy.destroy(); return false; }
      return true;
    });
  });

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

  // Props — scroll, advance Timed Burst timers, filter dead/offscreen.
  // Burst death results are consumed post-tick by GameplayRun (not here) to
  // avoid mutating bullet/effects collections during the tick.
  measurePerfPhase('tick.props', () => {
    for (const prop of world.props) prop.update(dt);
    world.props = world.props.filter(prop => {
      if (!prop.isAlive || prop.isOffscreen) { prop.destroy(); return false; }
      return true;
    });
  });

  // Effects
  measurePerfPhase('tick.effects', () => {
    for (const e of world.effects) e.update(dt);
    world.effects = world.effects.filter(e => {
      if (e.isDone) {
        e.destroy();
        return false;
      }
      return true;
    });
  });

}

function applyMargins(
  bounds: TerrainBounds | null,
  margins: { top: number; bottom: number } | null | undefined,
): TerrainBounds | null {
  if (!bounds || !margins) return bounds;
  return {
    top: bounds.top - margins.top,
    bottom: bounds.bottom + margins.bottom,
  };
}
