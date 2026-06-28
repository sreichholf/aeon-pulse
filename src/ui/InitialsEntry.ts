export class InitialsEntry {
  private _handler: ((e: KeyboardEvent) => void) | null;

  constructor() {
    this._handler = null;
  }

  // Start listening for initials input.
  // displayEl: the element that shows "_ _ _" updating live
  // onComplete(initials): called when 3 chars are entered
  start(displayEl: HTMLElement, onComplete: (initials: string) => void): void {
    this.stop();
    let buf = '';

    const handler = (e: KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(e.key) && buf.length < 3) {
        buf += e.key.toUpperCase();
        e.preventDefault();
      } else if (e.key === 'Backspace' && buf.length > 0) {
        buf = buf.slice(0, -1);
        e.preventDefault();
      }
      const chars = buf.split('').concat(['_', '_', '_']).slice(0, 3);
      displayEl.textContent = chars.join(' ');
      if (buf.length === 3) {
        this.stop();
        onComplete(buf);
      }
    };

    this._handler = handler;
    window.addEventListener('keydown', handler);
  }

  stop(): void {
    if (this._handler) {
      window.removeEventListener('keydown', this._handler);
      this._handler = null;
    }
  }
}
