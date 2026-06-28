import type { CampaignLevelRecord } from './Campaign.ts';
import { getNextImplementedLevel } from './Campaign.ts';
import { GameState, WeaponTier, type WeaponTierValue } from '../types.ts';

export interface ClearScores {
  baseScore: number;
  clearBonus: number;
  livesBonus: number;
  chapterBonus: number;
  totalScore: number;
}

export class CampaignAttempt {
  public static readonly CLEAR_BONUS = 10000;
  public static readonly LIVES_BONUS = 2000;
  public static readonly CHAPTER_BONUS = 25000;

  private _level: CampaignLevelRecord;
  private _weaponTier: WeaponTierValue;

  constructor(level: CampaignLevelRecord, weaponTier: WeaponTierValue = WeaponTier.RAPID) {
    this._level = level;
    this._weaponTier = weaponTier;
  }

  get level(): CampaignLevelRecord {
    return this._level;
  }

  set level(newLevel: CampaignLevelRecord) {
    this._level = newLevel;
  }

  get weaponTier(): WeaponTierValue {
    return this._weaponTier;
  }

  setWeaponTier(newWeaponTier: WeaponTierValue): void {
    this._weaponTier = newWeaponTier;
  }

  /**
   * Performs score calculation for completing the current level.
   */
  public calculateClearScores(livesCount: number, baseScore: number): ClearScores {
    const clearBonus = CampaignAttempt.CLEAR_BONUS;
    const livesBonus = livesCount * CampaignAttempt.LIVES_BONUS;
    const chapterBonus = this._level.isFinale ? CampaignAttempt.CHAPTER_BONUS : 0;
    const totalScore = baseScore + clearBonus + livesBonus + chapterBonus;

    return {
      baseScore,
      clearBonus,
      livesBonus,
      chapterBonus,
      totalScore,
    };
  }

  /**
   * Retrieves the next level record in the campaign.
   */
  public getNextLevel(): CampaignLevelRecord | null {
    return getNextImplementedLevel(this._level);
  }

  /**
   * Resolves the next game state transition after level completion.
   */
  public getNextGameState(): GameState {
    const nextLevel = this.getNextLevel();
    return nextLevel ? GameState.LEVEL_START : GameState.GAME_COMPLETE;
  }

  /**
   * Advances the attempt to the next level, preserving the current weapon tier.
   */
  public advance(): void {
    const nextLevel = this.getNextLevel();
    if (!nextLevel) {
      throw new Error('No next level to advance to.');
    }
    this._level = nextLevel;
  }
}
