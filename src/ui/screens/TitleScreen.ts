import type { LevelLabel } from '../../campaign/Campaign.ts';
import { DifficultyMode } from '../../types.ts';

interface ScoreEntry {
  initials: string;
  score: number;
}

export class TitleScreen {
  el: HTMLElement;
  private _titleModeValue!: HTMLElement;
  private _titleChapterValue!: HTMLElement;
  private _titleLevelValue!: HTMLElement;
  private _titleWeaponPips!: HTMLElement[];
  private _titleWeaponPipsBox!: HTMLElement;
  private _titleScoresHeader!: HTMLElement;
  private _titleScoresList!: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ui-screen';
    this.el.id = 'screen-title';
    this._build();
  }

  show(topScores: ScoreEntry[] = [], currentLevel: LevelLabel, weaponTier = 1, mode: DifficultyMode = DifficultyMode.ACE): void {
    this.el.classList.add('active');
    this.updateTitleLevel(currentLevel);
    this.updateTitleWeapon(weaponTier);
    this.updateTitleMode(mode);
    this._renderScoresList(this._titleScoresList, topScores, -1);
  }

  updateTitleMode(mode: DifficultyMode): void {
    if (this._titleModeValue) {
      this._titleModeValue.textContent = mode.toUpperCase();
    }
  }

  showTitleScores(topScores: ScoreEntry[]): void {
    this._renderScoresList(this._titleScoresList, topScores, -1);
  }

  hide(): void { this.el.classList.remove('active'); }

  updateTitleLevel(level: LevelLabel): void {
    if (this._titleChapterValue) this._titleChapterValue.textContent = level.chapterName;
    if (this._titleLevelValue) this._titleLevelValue.textContent = level.id;
  }

  updateTitleWeapon(tier: number): void {
    this._titleWeaponPips?.forEach((pip, i) => {
      pip.classList.toggle('active', i < tier);
    });
  }

  private _build(): void {
    const s = this.el;
    s.appendChild(this._el('div', 'title-logo', 'AEON PULSE'));

    // Mode selection prominently placed right under Logo
    const modeSelection = this._el('div', 'title-mode-selection');
    modeSelection.appendChild(this._el('span', 'title-mode-label', 'DIFFICULTY:'));
    this._titleModeValue = this._el('span', 'title-mode-value', 'ACE');
    modeSelection.appendChild(this._titleModeValue);
    modeSelection.appendChild(this._el('div', 'title-mode-hint', '[ PRESS TAB TO CHANGE ]'));
    s.appendChild(modeSelection);

    s.appendChild(this._el('div', 'title-start', 'PRESS SPACE TO START'));
    s.appendChild(this._el('div', 'title-viewer-hint', 'PRESS V FOR DATABASE | PRESS M TO TOGGLE MUSIC'));

    // Selector row: Level + Weapon (Developer Settings)
    const selectors = this._el('div', 'title-selectors');

    // Starting level selector
    const stageGroup = this._el('div', 'title-selector-group');
    stageGroup.appendChild(this._el('div', 'title-selector-label', 'LEVEL'));
    this._titleChapterValue = this._el('div', 'title-selector-chapter', '');
    this._titleLevelValue = this._el('div', 'title-selector-value', '1-5');
    stageGroup.appendChild(this._titleChapterValue);
    stageGroup.appendChild(this._titleLevelValue);
    stageGroup.appendChild(this._el('div', 'title-selector-hint', 'UP / DOWN'));
    selectors.appendChild(stageGroup);

    // Weapon tier selector
    const weaponGroup = this._el('div', 'title-selector-group');
    weaponGroup.appendChild(this._el('div', 'title-selector-label', 'WEAPON TIER'));
    this._titleWeaponPipsBox = this._el('div', 'title-weapon-pips');
    this._titleWeaponPips = [];
    for (let i = 0; i < 5; i++) {
      const pip = this._el('div', 'title-weapon-pip');
      this._titleWeaponPips.push(pip);
      this._titleWeaponPipsBox.appendChild(pip);
    }
    weaponGroup.appendChild(this._titleWeaponPipsBox);
    weaponGroup.appendChild(this._el('div', 'title-selector-hint', 'LEFT / RIGHT'));
    selectors.appendChild(weaponGroup);

    s.appendChild(selectors);

    this._titleScoresHeader = this._el('div', 'title-scores-header', 'HIGH SCORES');
    this._titleScoresList   = this._el('div', 'title-scores-list');
    s.appendChild(this._titleScoresHeader);
    s.appendChild(this._titleScoresList);
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
