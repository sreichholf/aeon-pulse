import { GAME_HEIGHT } from '../constants.ts';
import type { PlayfieldBounds } from '../types.ts';

const HALF_H = GAME_HEIGHT / 2;
const HUD_TOP_BAR_BOTTOM = 10 + 60;
const HUD_CHARGE_TOP = GAME_HEIGHT - 14 - 32;
const ACTOR_CLEARANCE = 18;

export const CHAPTER_1_PLAYFIELD_BOUNDS: PlayfieldBounds = {
  top: HALF_H - HUD_TOP_BAR_BOTTOM - ACTOR_CLEARANCE,
  bottom: -HALF_H + (GAME_HEIGHT - HUD_CHARGE_TOP) + ACTOR_CLEARANCE,
};
