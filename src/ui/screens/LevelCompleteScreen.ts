interface LevelCompleteArgs {
  title: string;
  clearTypeLabel: string;
  chapterName: string;
  levelId: string;
  baseScore: number;
  livesBonus: number;
  clearBonus: number;
  chapterBonus: number;
  onContinue?: () => void;
}

export class LevelCompleteScreen {
  el: HTMLElement;
  private _continueHandler: ((e: KeyboardEvent) => void) | null;
  private _chapterName!: HTMLElement;
  private _levelId!: HTMLElement;
  private _lcRows!: HTMLElement;
  private _lcDivider!: HTMLElement;
  private _lcTotal!: HTMLElement;
  private _lcContinue!: HTMLElement;
  private _lcTitle!: HTMLElement;
  private _lcClearType!: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ui-screen';
    this.el.id = 'screen-levelcomplete';
    this._continueHandler = null;
    this._build();
  }

  show({ title, clearTypeLabel, chapterName, levelId, baseScore, livesBonus, clearBonus, chapterBonus, onContinue }: LevelCompleteArgs): void {
    this._stopContinueInput();
    this.el.classList.add('active');

    const total = baseScore + livesBonus + clearBonus + chapterBonus;
    this._chapterName.textContent = chapterName;
    this._levelId.textContent = levelId;
    this._lcTitle.textContent = title;
    this._lcClearType.textContent = clearTypeLabel;

    this._lcRows.innerHTML = '';
    const rows = [
      ['SCORE',       baseScore],
      ['CLEAR BONUS', clearBonus],
      ...(chapterBonus > 0 ? [['CHAPTER BONUS', chapterBonus]] : []),
      ['LIVES BONUS', livesBonus],
    ];
    for (const [label, val] of rows) {
      const row = this._el('div', 'lc-row');
      row.innerHTML = `<span>${label}</span><span>${String(val).padStart(8, '0')}</span>`;
      this._lcRows.appendChild(row);
    }
    this._lcTotal.innerHTML = `<span>TOTAL</span><span>${String(total).padStart(8, '0')}</span>`;
    this._lcContinue.textContent = 'PRESS SPACE TO CONTINUE';

    this._startContinueInput(onContinue);
  }

  hide(): void {
    this._stopContinueInput();
    this.el.classList.remove('active');
  }

  private _startContinueInput(onContinue?: () => void): void {
    const handler = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        this._stopContinueInput();
        onContinue?.();
      }
    };
    this._continueHandler = handler;
    window.addEventListener('keydown', handler);
  }

  private _stopContinueInput(): void {
    if (this._continueHandler) {
      window.removeEventListener('keydown', this._continueHandler);
      this._continueHandler = null;
    }
  }

  private _build(): void {
    const s = this.el;

    this._chapterName = this._el('div', 'level-start-chapter');
    this._levelId = this._el('div', 'level-start-id');
    s.appendChild(this._chapterName);
    s.appendChild(this._levelId);

    this._lcTitle = this._el('div', 'lc-title', 'LEVEL COMPLETE');
    this._lcClearType = this._el('div', 'lc-clear-type', 'LEVEL CLEAR');
    s.appendChild(this._lcTitle);
    s.appendChild(this._lcClearType);

    this._lcRows    = this._el('div');
    this._lcDivider = this._el('hr', 'lc-divider');
    this._lcTotal   = this._el('div', 'lc-total');

    this._lcContinue = this._el('div', 'lc-continue');

    s.appendChild(this._lcRows);
    s.appendChild(this._lcDivider);
    s.appendChild(this._lcTotal);
    s.appendChild(this._lcContinue);
  }

  private _el(tag: string, cls?: string, text?: string): HTMLElement {
    const el = document.createElement(tag);
    if (cls)  el.className = cls;
    if (text) el.textContent = text;
    return el;
  }
}
