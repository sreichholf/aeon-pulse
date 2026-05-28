import { DifficultyMode } from '../types.ts';

const MAX_SCORES  = 10;
const MAX_LIVES   = 3;

interface ScoreEntry {
  initials: string;
  score: number;
  mode?: string;
}

export class ScoreManager {
  private _mode: DifficultyMode;
  private _storageKey: string;
  score: number;
  hiScore: number;
  lives: number;

  constructor(mode: DifficultyMode = DifficultyMode.ROOKIE) {
    this._mode = mode;
    this._storageKey = `aeon-pulse-scores-${mode}`;

    this.score   = 0;
    this.hiScore = this._loadHiScore();
    this.lives   = MAX_LIVES;
  }

  reset(): void {
    this.score = 0;
    this.lives = MAX_LIVES;
  }

  addScore(points: number): void {
    this.score += points;
    if (this.score > this.hiScore) this.hiScore = this.score;
  }

  loseLife(): void {
    this.lives = Math.max(0, this.lives - 1);
  }

  gainLife(): void {
    this.lives = Math.min(MAX_LIVES, this.lives + 1);
  }

  get isGameOver(): boolean {
    return this.lives <= 0;
  }

  getTopScores(): ScoreEntry[] {
    try {
      return (JSON.parse(localStorage.getItem(this._storageKey) ?? 'null') as ScoreEntry[] | null) ?? [];
    } catch { return []; }
  }

  saveScore(initials: string): void {
    const entry: ScoreEntry  = { initials: (initials ?? 'AAA').toUpperCase().slice(0, 3), score: this.score };
    const scores = [...this.getTopScores(), entry]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_SCORES);
    try { localStorage.setItem(this._storageKey, JSON.stringify(scores)); } catch (_) {}
    if (scores.length) this.hiScore = Math.max(this.hiScore, scores[0]!.score);
  }

  private _loadHiScore(): number {
    const scores = this.getTopScores();
    return scores.length ? scores[0]!.score : 0;
  }
}
