interface ViewerEntityData {
  name: string | undefined;
  hp: number;
  score: number;
  x: number;
  y: number;
}

export class ViewerScreen {
  el: HTMLElement;
  bgEl: HTMLElement;
  private _viewerPageTitle!: HTMLElement;
  private _viewerCardsContainer!: HTMLElement;
  private _viewerBgCardsContainer!: HTMLElement;

  constructor() {
    // Main overlay element
    this.el = document.createElement('div');
    this.el.className = 'ui-screen';
    this.el.id = 'screen-viewer';

    // Background layer element (mounted separately by UI.js into a different container)
    this.bgEl = document.createElement('div');
    this.bgEl.className = 'ui-screen';
    this.bgEl.id = 'screen-viewer-bg';

    this._build();
    this._buildBg();
  }

  show(page: number, entities: ViewerEntityData[]): void {
    this.el.classList.add('active');
    this.bgEl.classList.add('active');

    if (page === 1) {
      this._viewerPageTitle.textContent = 'STAGE ENEMIES [PAGE 1/2]';
    } else {
      this._viewerPageTitle.textContent = 'LEVEL BOSSES [PAGE 2/2]';
    }

    this._viewerCardsContainer.innerHTML = '';
    this._viewerBgCardsContainer.innerHTML = '';

    for (const ent of entities) {
      const isBoss = page === 2;
      const card = this._el('div', 'viewer-card' + (isBoss ? ' boss-card' : ''));

      const left = ent.x + 480;
      // Shift cards downward relative to 3D entities.
      // Standard enemy cards are shifted by 20px, boss cards are shifted by 25px.
      const top = -ent.y + 270 + (isBoss ? 25 : 20);
      card.style.left = `${left}px`;
      card.style.top = `${top}px`;

      const info = this._el('div', 'viewer-card-info');

      const name = this._el('div', 'viewer-card-name', ent.name);
      info.appendChild(name);

      const stats = this._el('div', 'viewer-card-stats');
      stats.innerHTML = `<span>HP ${ent.hp}</span><span>PTS ${ent.score}</span>`;
      info.appendChild(stats);

      card.appendChild(info);
      this._viewerCardsContainer.appendChild(card);

      const bgCard = this._el('div', 'viewer-bg-card' + (isBoss ? ' boss-card' : ''));
      bgCard.style.left = `${left}px`;
      bgCard.style.top = `${top}px`;
      this._viewerBgCardsContainer.appendChild(bgCard);
    }
  }

  hide(): void {
    this.el.classList.remove('active');
    this.bgEl.classList.remove('active');
    if (this._viewerCardsContainer)   this._viewerCardsContainer.innerHTML = '';
    if (this._viewerBgCardsContainer) this._viewerBgCardsContainer.innerHTML = '';
  }

  private _build(): void {
    const s = this.el;

    s.appendChild(this._el('div', 'viewer-header', 'TACTICAL DATABASE'));
    this._viewerPageTitle = this._el('div', 'viewer-subheader', '');
    s.appendChild(this._viewerPageTitle);

    this._viewerCardsContainer = this._el('div', 'viewer-cards-container');
    s.appendChild(this._viewerCardsContainer);

    const controls = this._el('div', 'viewer-controls');
    controls.innerHTML = '<span class="control-key">LEFT / RIGHT</span> TO PAGINATE  •  <span class="control-key">ESC</span> TO RETURN TO TITLE';
    s.appendChild(controls);
  }

  private _buildBg(): void {
    const s = this.bgEl;

    this._viewerBgCardsContainer = this._el('div', 'viewer-bg-cards-container');
    s.appendChild(this._viewerBgCardsContainer);
  }

  private _el(tag: string, cls?: string, text?: string): HTMLElement {
    const el = document.createElement(tag);
    if (cls)  el.className = cls;
    if (text) el.textContent = text;
    return el;
  }
}
