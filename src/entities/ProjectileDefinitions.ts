import * as THREE from 'three';
import { BulletType } from '../types.ts';
import { playerDefs, type BulletAnimRefs, type BulletBuildResult, type BulletDef, type CacheStore, type GetFn } from './BulletsPlayer.ts';
import { enemyDefs } from './BulletsEnemy.ts';

const DEFAULT_OFFSCREEN_PADDING_X = 100;
const DEFAULT_OFFSCREEN_PADDING_Y = 60;
const DEFAULT_HOMING_TURN_RATE = 2.8;
const DEFAULT_HOMING_EVASION_PAST_TARGET_X = 15;
const DEFAULT_WAVE_AMPLITUDE = 45;
const DEFAULT_WAVE_ANGULAR_SPEED = 20;

export enum ProjectileFaction {
  PLAYER = 'player',
  HOSTILE = 'hostile',
}

export enum ProjectileMotionKind {
  LINEAR = 'linear',
  HOMING = 'homing',
  LINEAR_WAVE = 'linearWave',
}

export interface ProjectileCollision {
  halfWidth: number;
  halfHeight: number;
  offscreenPaddingX: number;
  offscreenPaddingY: number;
}

export interface ProjectileDamage {
  amount: number;
  piercing: boolean;
}

interface ProjectileMovementBase {
  alignToVelocity: boolean;
}

export type ProjectileMovement =
  | (ProjectileMovementBase & { kind: ProjectileMotionKind.LINEAR })
  | (ProjectileMovementBase & {
      kind: ProjectileMotionKind.HOMING;
      turnRate: number;
      evasionPastTargetX: number;
    })
  | (ProjectileMovementBase & {
      kind: ProjectileMotionKind.LINEAR_WAVE;
      amplitude: number;
      angularSpeed: number;
    });

export interface ProjectilePresentation {
  build(
    tint: number | null,
    cache: CacheStore,
    getMat: GetFn<THREE.Material>,
    getGeo: GetFn<THREE.BufferGeometry>,
  ): BulletBuildResult;
  animate?(dt: number, mesh: THREE.Object3D, refs: BulletAnimRefs): void;
}

export interface ProjectileDefinition {
  id: BulletType;
  sourceKey: string;
  faction: ProjectileFaction;
  collision: ProjectileCollision;
  damage: ProjectileDamage;
  movement: ProjectileMovement;
  presentation: ProjectilePresentation;
}

const LEGACY_DEFS: Record<string, BulletDef> = { ...playerDefs, ...enemyDefs };

const CANONICAL_BULLET_TYPES: ReadonlySet<string> = new Set([
  BulletType.PLAYER,
  BulletType.PLAYER_CHARGE,
  BulletType.PLAYER_WAVE,
  BulletType.PLAYER_PLASMA,
  BulletType.ENEMY,
  BulletType.HOMING,
  BulletType.BOSS,
  BulletType.BOSS_LASER,
  BulletType.WAVE,
  BulletType.LAVA,
]);

function canonicalBulletType(key: string): BulletType {
  return (CANONICAL_BULLET_TYPES.has(key) ? key : BulletType.ENEMY) as BulletType;
}

function movementFor(def: BulletDef): ProjectileMovement {
  const alignToVelocity = def.alignToVelocity ?? false;

  if (def.homing) {
    return {
      kind: ProjectileMotionKind.HOMING,
      alignToVelocity,
      turnRate: DEFAULT_HOMING_TURN_RATE,
      evasionPastTargetX: DEFAULT_HOMING_EVASION_PAST_TARGET_X,
    };
  }

  if (def.wave) {
    return {
      kind: ProjectileMotionKind.LINEAR_WAVE,
      alignToVelocity,
      amplitude: def.waveAmp ?? DEFAULT_WAVE_AMPLITUDE,
      angularSpeed: def.waveSpeed ?? DEFAULT_WAVE_ANGULAR_SPEED,
    };
  }

  return {
    kind: ProjectileMotionKind.LINEAR,
    alignToVelocity,
  };
}

function deepenDefinition(sourceKey: string, def: BulletDef): ProjectileDefinition {
  return {
    id: canonicalBulletType(def.key),
    sourceKey,
    faction: def.isPlayer ? ProjectileFaction.PLAYER : ProjectileFaction.HOSTILE,
    collision: {
      halfWidth: def.hw,
      halfHeight: def.hh,
      offscreenPaddingX: DEFAULT_OFFSCREEN_PADDING_X,
      offscreenPaddingY: DEFAULT_OFFSCREEN_PADDING_Y,
    },
    damage: {
      amount: def.damage,
      piercing: def.piercing,
      pierceCount: def.pierceCount,
    },
    movement: movementFor(def),
    presentation: {
      build: def.build,
      animate: def.animate,
    },
  };
}

export const PROJECTILE_DEFINITIONS: Record<string, ProjectileDefinition> = Object.fromEntries(
  Object.entries(LEGACY_DEFS).map(([sourceKey, def]) => [sourceKey, deepenDefinition(sourceKey, def)]),
);

export function getProjectileDefinition(type: string): ProjectileDefinition {
  const def = PROJECTILE_DEFINITIONS[type];
  if (!def) {
    throw new Error(`Unknown projectile type: ${type}`);
  }
  return def;
}
