export class PauseScreen {
  el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ui-screen';
    this.el.id = 'screen-pause';
    this._build();
  }

  show(): void { this.el.classList.add('active'); }
  hide(): void { this.el.classList.remove('active'); }

  private _build(): void {
    const title = document.createElement('div');
    title.className = 'pause-title';
    title.textContent = 'PAUSED';

    const status = document.createElement('div');
    status.className = 'pause-status';
    status.textContent = 'SYSTEM HOLD';

    const resume = document.createElement('div');
    resume.className = 'pause-resume';
    resume.textContent = 'RESUME';

    this.el.appendChild(title);
    this.el.appendChild(status);
    this.el.appendChild(resume);
  }
}
