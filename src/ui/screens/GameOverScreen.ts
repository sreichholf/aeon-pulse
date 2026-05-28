import { InitialsEntry } from '../InitialsEntry.ts';

interface ScoreEntry {
  initials: string;
  score: number;
}

export class GameOverScreen {
  el: HTMLElement;
  private _initials: InitialsEntry;
  private _goScore!: HTMLElement;
  private _goInitialsPrompt!: HTMLElement;
  private _goInitialsDisplay!: HTMLElement;
  private _goInitialsHint!: HTMLElement;
  private _goScoresHeader!: HTMLElement;
  private _goScoresList!: HTMLElement;
  private _goRestart!: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ui-screen';
    this.el.id = 'screen-gameover';
    this._initials = new InitialsEntry();
    this._build();
  }

  show(score: number, topScores: ScoreEntry[] = [], onSubmit?: (initials: string) => void): void {
    this.el.classList.add('active');
    this._goScore.textContent = 'SCORE  ' + String(score).padStart(8, '0');

    const qualifies = topScores.length < 10 || score > topScores[topScores.length - 1]!.score;

    if (qualifies) {
      this._goInitialsPrompt.textContent  = 'NEW HIGH SCORE!  ENTER YOUR INITIALS';
      this._goInitialsDisplay.textContent = '_ _ _';
      this._goInitialsDisplay.style.display = '';
      this._goInitialsHint.style.display    = '';
      this._goRestart.textContent = '';
      this._initials.start(this._goInitialsDisplay, (buf) => {
        onSubmit?.(buf);
        const updated = [{ initials: buf, score }, ...topScores]
          .sort((a, b) => b.score - a.score).slice(0, 10);
        const newIdx = updated.findIndex(e => e.initials === buf && e.score === score);
        this._renderScoresList(this._goScoresList, updated, newIdx);
        this._goInitialsPrompt.textContent    = '';
        this._goInitialsDisplay.style.display = 'none';
        this._goInitialsHint.style.display    = 'none';
        this._goRestart.textContent = 'PRESS SPACE TO RESTART';
      });
    } else {
      this._goInitialsPrompt.textContent    = '';
      this._goInitialsDisplay.style.display = 'none';
      this._goInitialsHint.style.display    = 'none';
      this._goRestart.textContent = 'PRESS SPACE TO RESTART';
      this._renderScoresList(this._goScoresList, topScores, -1);
    }
  }

  hide(): void {
    this._initials.stop();
    this.el.classList.remove('active');
  }

  private _build(): void {
    const s = this.el;

    s.appendChild(this._el('div', 'go-title', 'GAME OVER'));
    this._goScore = this._el('div', 'go-score');
    s.appendChild(this._goScore);

    this._goInitialsPrompt  = this._el('div', 'go-initials-prompt');
    this._goInitialsDisplay = this._el('div', 'go-initials-display', '_ _ _');
    this._goInitialsHint    = this._el('div', 'go-initials-hint', 'TYPE 3 LETTERS  •  BACKSPACE TO CORRECT');
    s.appendChild(this._goInitialsPrompt);
    s.appendChild(this._goInitialsDisplay);
    s.appendChild(this._goInitialsHint);

    this._goScoresHeader = this._el('div', 'go-scores-header', 'TOP SCORES');
    this._goScoresList   = this._el('div', 'go-scores-list');
    s.appendChild(this._goScoresHeader);
    s.appendChild(this._goScoresList);

    this._goRestart = this._el('div', 'go-restart');
    s.appendChild(this._goRestart);
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
