import type { LevelLabel } from '../../campaign/Campaign.ts';

export class LevelStartScreen {
  el: HTMLElement;
  private _chapterName!: HTMLElement;
  private _levelId!: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ui-screen';
    this.el.id = 'screen-levelstart';
    this._build();
  }

  show(level: LevelLabel): void {
    this._chapterName.textContent = level.chapterName;
    this._levelId.textContent = level.id;
    this.el.classList.add('active');
  }

  hide(): void { this.el.classList.remove('active'); }

  private _build(): void {
    this._chapterName = this._el('div', 'level-start-chapter');
    this._levelId = this._el('div', 'level-start-id');
    this.el.appendChild(this._chapterName);
    this.el.appendChild(this._levelId);
  }

  private _el(tag: string, cls?: string, text?: string): HTMLElement {
    const el = document.createElement(tag);
    if (cls) el.className = cls;
    if (text) el.textContent = text;
    return el;
  }
}
