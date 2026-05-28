const MAX_LIVES = 3;

interface HUDArgs {
  score?: number;
  hiScore?: number;
  lives?: number;
  chargeLevel?: number;
  weaponTier?: number;
  shieldPips?: number;
  shieldMax?: number;
  shieldRegenPct?: number;
}

export class HUDScreen {
  el: HTMLElement;
  private _topBar!: HTMLElement;
  private _hudScore!: HTMLElement;
  private _hudHiScore!: HTMLElement;
  private _shieldBox!: HTMLElement;
  private _shieldPipsList!: HTMLElement[];
  private _shieldRegenFill!: HTMLElement;
  private _livesBox!: HTMLElement;
  private _lifeIcons!: HTMLElement[];
  private _chargeFill!: HTMLElement;
  private _weaponPipsBox!: HTMLElement;
  private _weaponPips!: HTMLElement[];

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ui-screen';
    this.el.id = 'screen-hud';
    this._build();
  }

  show(): void { this.el.classList.add('active'); }
  hide(): void { this.el.classList.remove('active'); }

  updateHUD({ score = 0, hiScore = 0, lives = MAX_LIVES, chargeLevel = 0, weaponTier = 1,
              shieldPips = 0, shieldMax = 0, shieldRegenPct = 0 }: HUDArgs = {}): void {
    this._hudScore.textContent   = String(score).padStart(8, '0');
    this._hudHiScore.textContent = String(hiScore).padStart(8, '0');

    this._lifeIcons.forEach((icon, i) => {
      icon.classList.toggle('empty', i >= lives);
    });

    const pct = Math.round(chargeLevel * 100);
    this._chargeFill.style.width = pct + '%';
    this._chargeFill.classList.toggle('full', chargeLevel >= 1);

    this._weaponPips.forEach((pip, i) => {
      pip.classList.toggle('active', i < weaponTier);
    });

    // Update Shield display
    if (shieldMax === 0) {
      this._shieldBox.style.display = 'none';
    } else {
      this._shieldBox.style.display = 'flex';
      this._shieldPipsList.forEach((pip, i) => {
        if (i < shieldMax) {
          pip.style.display = 'block';
          pip.classList.toggle('active', i < shieldPips);
        } else {
          pip.style.display = 'none';
        }
      });
      const regenFillPct = Math.round(shieldRegenPct * 100);
      this._shieldRegenFill.style.width = regenFillPct + '%';
    }
  }

  private _build(): void {
    const s = this.el;

    this._topBar = this._el('div', 'hud-top-bar');

    const scoreBox = this._el('div', 'hud-score');
    scoreBox.innerHTML = '<span class="hud-label">SCORE</span>';
    this._hudScore = this._el('span', '', '0');
    scoreBox.appendChild(this._hudScore);
    this._topBar.appendChild(scoreBox);

    const hiBox = this._el('div', 'hud-hiscore');
    hiBox.innerHTML = '<span class="hud-label">HI-SCORE</span>';
    this._hudHiScore = this._el('span', '', '0');
    hiBox.appendChild(this._hudHiScore);
    this._topBar.appendChild(hiBox);

    const rightContainer = this._el('div', 'hud-top-bar-right');

    this._shieldBox = this._el('div', 'hud-shield');
    this._shieldBox.innerHTML = '<span class="hud-label">SHIELD</span>';
    const pipsBox = this._el('div', 'hud-shield-pips');
    this._shieldPipsList = [];
    for (let i = 0; i < 2; i++) {
      const pip = this._el('div', 'hud-shield-pip');
      this._shieldPipsList.push(pip);
      pipsBox.appendChild(pip);
    }
    this._shieldBox.appendChild(pipsBox);

    const regenTrack = this._el('div', 'hud-shield-regen-track');
    this._shieldRegenFill = this._el('div', 'hud-shield-regen-fill');
    regenTrack.appendChild(this._shieldRegenFill);
    this._shieldBox.appendChild(regenTrack);
    rightContainer.appendChild(this._shieldBox);

    this._livesBox = this._el('div', 'hud-lives');
    this._livesBox.innerHTML = '<span class="hud-label">LIVES</span>';
    const livesIconsBox = this._el('div', 'hud-lives-icons');
    this._lifeIcons = [];
    for (let i = 0; i < MAX_LIVES; i++) {
      const icon = this._el('div', 'hud-life');
      this._lifeIcons.push(icon);
      livesIconsBox.appendChild(icon);
    }
    this._livesBox.appendChild(livesIconsBox);
    rightContainer.appendChild(this._livesBox);

    this._topBar.appendChild(rightContainer);
    s.appendChild(this._topBar);

    const chargeBox = this._el('div', 'hud-charge');
    chargeBox.appendChild(this._el('span', 'hud-charge-label', 'CHARGE'));
    const track = this._el('div', 'hud-charge-track');
    this._chargeFill = this._el('div', 'hud-charge-fill');
    track.appendChild(this._chargeFill);
    chargeBox.appendChild(track);

    this._weaponPipsBox = this._el('div', 'hud-weapon-pips');
    this._weaponPips = [];
    for (let i = 0; i < 5; i++) {
      const pip = this._el('div', 'hud-weapon-pip');
      this._weaponPips.push(pip);
      this._weaponPipsBox.appendChild(pip);
    }
    chargeBox.appendChild(this._weaponPipsBox);

    s.appendChild(chargeBox);
  }

  private _el(tag: string, cls?: string, text?: string): HTMLElement {
    const el = document.createElement(tag);
    if (cls)  el.className = cls;
    if (text) el.textContent = text;
    return el;
  }
}
