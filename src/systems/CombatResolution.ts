import type { IPowerUp } from '../types.ts';
import {
  CollisionContactKind,
  type CollisionContact,
} from './Collisions.ts';

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
      if (!bullet.isPiercing) bullet.active = false;

      if (death) {
        onHit({
          kind: HitEventKind.ENEMY_KILLED,
          x: death.x,
          y: death.y,
          score: enemy.score,
          dropPowerup: death.dropPowerup,
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
        });
      }
      break;
    }

    case CollisionContactKind.POWERUP_PLAYER:
      onHit({ kind: HitEventKind.POWERUP_COLLECTED, powerup: contact.powerup });
      break;
  }
}
