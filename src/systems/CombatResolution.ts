import type { IPowerUp, IEnemy, IBoss, IPlayer, IProp, PropHitResult } from '../types.ts';
import {
  CollisionContactKind,
  type CollisionContact,
} from './Collisions.ts';
import { pushPlayerOutOfSolidProp } from './SolidPropPhysicality.ts';

export enum HitEventKind {
  ENEMY_KILLED = 'enemy-killed',
  BOSS_HIT = 'boss-hit',
  PROP_DESTROYED = 'prop-destroyed',
  PLAYER_HIT = 'player-hit',
  POWERUP_COLLECTED = 'powerup-collected',
}

export enum HitCause {
  BULLET = 'bullet',
  TERRAIN = 'terrain',
  RAM = 'ram',
  LASER = 'laser',
  SOLID_PROP = 'solid-prop',
}

export type HitEvent =
  | { kind: HitEventKind.ENEMY_KILLED; x: number; y: number; score: number; dropPowerup: boolean; triggerCancellation?: boolean }
  | { kind: HitEventKind.BOSS_HIT; x: number; y: number }
  | { kind: HitEventKind.PROP_DESTROYED; result: PropHitResult }
  | { kind: HitEventKind.PLAYER_HIT; cause: HitCause; x: number; y: number }
  | { kind: HitEventKind.POWERUP_COLLECTED; powerup: IPowerUp };

export enum DamageSource {
  BULLET = 'bullet',
  LASER = 'laser',
  RAM = 'ram',
  TERRAIN = 'terrain',
  SMART_BOMB = 'smart-bomb',
  ENVIRONMENTAL = 'environmental',
  SOLID_PROP = 'solid-prop',
}

export interface DamageRequest {
  target: IEnemy | IBoss | IPlayer | IProp;
  amount: number;
  source: DamageSource;
}

export interface AreaDamageIntent {
  enemyDamage: number;
  bossDamagePct: number;
  activeBounds: { minX: number; maxX: number };
}

export function resolveAreaDamage(
  intent: AreaDamageIntent,
  targets: { enemies: readonly IEnemy[]; boss: IBoss | null; props: readonly IProp[] },
  onHit: (event: HitEvent) => void
): void {
  const requests: DamageRequest[] = [];

  for (const enemy of targets.enemies) {
    if (enemy.isAlive && enemy.x >= intent.activeBounds.minX && enemy.x <= intent.activeBounds.maxX) {
      requests.push({ target: enemy, amount: intent.enemyDamage, source: DamageSource.SMART_BOMB });
    }
  }

  for (const prop of targets.props) {
    if (prop.isAlive && prop.x >= intent.activeBounds.minX && prop.x <= intent.activeBounds.maxX) {
      requests.push({ target: prop, amount: intent.enemyDamage, source: DamageSource.SMART_BOMB });
    }
  }

  if (targets.boss && targets.boss.isAlive && !targets.boss.isDying) {
    requests.push({ target: targets.boss, amount: targets.boss.maxHp * intent.bossDamagePct, source: DamageSource.SMART_BOMB });
  }

  resolveDamageRequests(requests, onHit);
}

export function resolveDamageRequests(
  requests: readonly DamageRequest[],
  onHit: (event: HitEvent) => void
): void {
  for (const req of requests) {
    if ('propType' in req.target) {
      const prop = req.target as IProp;
      if (!prop.isAlive) continue;
      const death = prop.hit(req.amount);
      if (death) onHit({ kind: HitEventKind.PROP_DESTROYED, result: death });
    } else if ('isBoss' in req.target && req.target.isBoss) {
      const boss = req.target as IBoss;
      if (boss.isDying) continue;
      boss.hit(req.amount);
      onHit({ kind: HitEventKind.BOSS_HIT, x: boss.x, y: boss.y });
    } else if ('isBoss' in req.target && !req.target.isBoss) {
      const enemy = req.target as IEnemy;
      if (!enemy.isAlive) continue;
      const death = enemy.hit(req.amount);
      if (death) {
        onHit({
          kind: HitEventKind.ENEMY_KILLED,
          x: death.x,
          y: death.y,
          score: enemy.score,
          dropPowerup: death.dropPowerup,
          triggerCancellation: death.triggerCancellation,
        });
      }
    } else {
      const player = req.target as IPlayer;
      if (player.hit()) {
        const cause = req.source === DamageSource.SMART_BOMB ? HitCause.LASER : HitCause.BULLET; // Default fallback
        onHit({
          kind: HitEventKind.PLAYER_HIT,
          cause,
          x: player.x,
          y: player.y,
        });
      }
    }
  }
}

export function resolveCollisionContacts(contacts: readonly CollisionContact[], onHit: (event: HitEvent) => void): void {
  for (const contact of contacts) {
    resolveCollisionContact(contact, onHit);
  }
}

function resolveCollisionContact(contact: CollisionContact, onHit: (event: HitEvent) => void): void {
  switch (contact.kind) {
    case CollisionContactKind.PLAYER_BULLET_ENEMY: {
      const { bullet, enemy } = contact;
      if (!bullet.active || !enemy.isAlive) return;

      const death = enemy.hit(bullet.damage);
      if (bullet.isPiercing) {
        if (bullet.remainingPierce !== undefined) {
          bullet.remainingPierce--;
          if (bullet.remainingPierce <= 0) {
            bullet.active = false;
          }
        }
      } else {
        bullet.active = false;
      }

      if (death) {
        onHit({
          kind: HitEventKind.ENEMY_KILLED,
          x: death.x,
          y: death.y,
          score: enemy.score,
          dropPowerup: death.dropPowerup,
          triggerCancellation: death.triggerCancellation,
        });
      }
      break;
    }

    case CollisionContactKind.PLAYER_BULLET_BOSS: {
      const { bullet, boss, zone } = contact;
      if (!bullet.active || boss.isDying) return;

      boss.hit(bullet.damage, zone.id);
      if (!bullet.isPiercing) bullet.active = false;
      onHit({ kind: HitEventKind.BOSS_HIT, x: bullet.x, y: bullet.y });
      break;
    }

    case CollisionContactKind.PLAYER_BULLET_PROP: {
      const { bullet, prop } = contact;
      if (!bullet.active || !prop.isAlive) return;

      if (bullet.isPiercing) {
        if (bullet.remainingPierce !== undefined) {
          bullet.remainingPierce--;
          if (bullet.remainingPierce <= 0) bullet.active = false;
        }
      } else {
        bullet.active = false;
      }

      const death = prop.hit(bullet.damage);
      if (death) onHit({ kind: HitEventKind.PROP_DESTROYED, result: death });
      break;
    }

    case CollisionContactKind.PLAYER_SOLID_PROP: {
      const { player, prop } = contact;
      const hitApplied = player.hit();
      const bounds = prop.getSolidBounds();
      if (bounds) pushPlayerOutOfSolidProp(player, bounds);
      if (hitApplied) {
        onHit({
          kind: HitEventKind.PLAYER_HIT,
          cause: HitCause.SOLID_PROP,
          x: player.x,
          y: player.y,
        });
      }
      break;
    }

    case CollisionContactKind.ENEMY_BULLET_SOLID_PROP: {
      contact.bullet.active = false;
      break;
    }

    case CollisionContactKind.ENEMY_SOLID_PROP:
      // Informational contact: no damage to either party.
      break;

    case CollisionContactKind.BOSS_LASER_PLAYER:
      if (contact.player.hit()) {
        onHit({
          kind: HitEventKind.PLAYER_HIT,
          cause: HitCause.LASER,
          x: contact.player.x,
          y: contact.player.y,
        });
      }
      break;

    case CollisionContactKind.PLAYER_TERRAIN:
      if (contact.player.hit()) {
        onHit({
          kind: HitEventKind.PLAYER_HIT,
          cause: HitCause.TERRAIN,
          x: contact.player.x,
          y: contact.player.y,
        });
      }
      break;

    case CollisionContactKind.ENEMY_BULLET_PLAYER: {
      const { bullet, player } = contact;
      if (!bullet.active) return;

      if (player.hit()) {
        onHit({
          kind: HitEventKind.PLAYER_HIT,
          cause: HitCause.BULLET,
          x: player.x,
          y: player.y,
        });
      }
      bullet.active = false;
      break;
    }

    case CollisionContactKind.ENEMY_RAM_PLAYER: {
      const { enemy, player } = contact;
      if (!enemy.isAlive) return;

      if (player.hit()) {
        onHit({
          kind: HitEventKind.PLAYER_HIT,
          cause: HitCause.RAM,
          x: player.x,
          y: player.y,
        });
      }

      const death = enemy.hit(999);
      if (death) {
        onHit({
          kind: HitEventKind.ENEMY_KILLED,
          x: death.x,
          y: death.y,
          score: 0,
          dropPowerup: death.dropPowerup,
          triggerCancellation: death.triggerCancellation,
        });
      }
      break;
    }

    case CollisionContactKind.POWERUP_PLAYER:
      onHit({ kind: HitEventKind.POWERUP_COLLECTED, powerup: contact.powerup });
      break;
  }
}
