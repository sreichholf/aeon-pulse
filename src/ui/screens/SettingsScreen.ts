export class SettingsScreen {
  el: HTMLElement;

  constructor() {
    this.el = document.createElement('div');
    this.el.className = 'ui-screen';
    this.el.id = 'screen-settings';
  }

  show(): void { this.el.classList.add('active'); }
  hide(): void { this.el.classList.remove('active'); }
}
