import { InitialsEntry } from '../InitialsEntry.ts';

interface ScoreEntry {
  initials: string;
  score: number;
}

export class GameCompleteScreen {
  el: HTMLElement;
  private _initials: InitialsEntry;
  private _gcScore!: HTMLElement;
  private _gcScores!: HTMLElement;
  private _gcContinue!: HTMLElement;
  private _gcInitialsPrompt!: HTMLElement;
  private _gcInitialsDisplay!: HTMLElement;
  private _gcInitialsHint!: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ui-screen';
    this.el.id = 'screen-gamecomplete';
    this._initials = new InitialsEntry();
    this._build();
  }

  show(score: number, topScores: ScoreEntry[] = [], onSubmit?: (initials: string) => void): void {
    this.el.classList.add('active');
    this._gcScore.textContent = `FINAL SCORE  ${String(score).padStart(8, '0')}`;

    const qualifies = topScores.length < 10 || score > (topScores[topScores.length - 1]?.score ?? 0);

    if (qualifies) {
      this._gcInitialsPrompt.textContent  = 'NEW HIGH SCORE!  ENTER YOUR INITIALS';
      this._gcInitialsDisplay.textContent = '_ _ _';
      this._gcInitialsDisplay.style.display = '';
      this._gcInitialsHint.style.display    = '';
      this._gcContinue.textContent = '';
      this._initials.start(this._gcInitialsDisplay, (buf) => {
        onSubmit?.(buf);
        const updated = [{ initials: buf, score }, ...topScores]
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
        const newIdx = updated.findIndex(e => e.initials === buf && e.score === score);
        this._renderScoresList(this._gcScores, updated, newIdx);
        this._gcInitialsPrompt.textContent    = '';
        this._gcInitialsDisplay.style.display = 'none';
        this._gcInitialsHint.style.display    = 'none';
        this._gcContinue.textContent = 'PRESS SPACE TO RETURN';
      });
    } else {
      this._gcInitialsPrompt.textContent    = '';
      this._gcInitialsDisplay.style.display = 'none';
      this._gcInitialsHint.style.display    = 'none';
      this._gcContinue.textContent = 'PRESS SPACE TO RETURN';
      const hi = topScores.findIndex(e => e.score === score);
      this._renderScoresList(this._gcScores, topScores, hi);
    }
  }

  hide(): void {
    this._initials.stop();
    this.el.classList.remove('active');
  }

  private _build(): void {
    const s = this.el;

    s.appendChild(this._el('div', 'gc-title', 'GAME COMPLETE'));
    s.appendChild(this._el('div', 'gc-subtitle', 'MISSION ACCOMPLISHED'));

    this._gcScore    = this._el('div', 'gc-score');
    this._gcScores   = this._el('div', 'title-scores-list');
    this._gcContinue = this._el('div', 'gc-continue', 'PRESS FIRE TO RETURN');

    s.appendChild(this._gcScore);

    this._gcInitialsPrompt  = this._el('div', 'go-initials-prompt');
    this._gcInitialsDisplay = this._el('div', 'go-initials-display', '_ _ _');
    this._gcInitialsHint    = this._el('div', 'go-initials-hint', 'TYPE 3 LETTERS  •  BACKSPACE TO CORRECT');
    s.appendChild(this._gcInitialsPrompt);
    s.appendChild(this._gcInitialsDisplay);
    s.appendChild(this._gcInitialsHint);

    const scoresHeader = this._el('div', 'go-scores-header', 'HIGH SCORES');
    s.appendChild(scoresHeader);
    s.appendChild(this._gcScores);
    s.appendChild(this._gcContinue);
  }

  private _renderScoresList(container: HTMLElement, scores: ScoreEntry[], highlightIdx: number): void {
    container.innerHTML = '';
    if (!scores.length) {
      container.appendChild(this._el('div', 'title-scores-empty', '- NO SCORES YET -'));
      return;
    }
    for (let i = 0; i < Math.min(scores.length, 10); i++) {
      const entry = scores[i];
      if (!entry) continue;
      const { initials, score } = entry;
      const row = this._el('div', i === highlightIdx ? 'new-entry' : '');
      row.innerHTML =
        `<span class="rank">${String(i + 1).padStart(2, '0')}.</span>` +
        `<span class="ini">${(initials || '???').padEnd(3)}</span>` +
        `<span>${String(score).padStart(8, '0')}</span>`;
      container.appendChild(row);
    }
  }

  private _el(tag: string, cls?: string, text?: string): HTMLElement {
    const el = document.createElement(tag);
    if (cls)  el.className = cls;
    if (text) el.textContent = text;
    return el;
  }
}
