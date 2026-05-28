import type { AudioManager } from '../../systems/audio/AudioManager.ts';

export class VolumeControl {
  el: HTMLElement;
  private _audio: AudioManager | null;
  private _isMuted: boolean;
  private _savedVolBeforeMute: number;

  // audio: the AudioManager instance (may be null)
  constructor(audio: AudioManager | null) {
    this._audio = audio;
    this._isMuted = false;
    this._savedVolBeforeMute = 0.20;
    this.el = document.createElement('div');
    this.el.id = 'volume-control';
    this._build();
  }

  private _build(): void {
    const volCtrl = this.el;

    const btn = this._el('button', 'volume-btn');
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" id="volume-svg-icon">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
      </svg>
    `;
    volCtrl.appendChild(btn);

    const sliderContainer = this._el('div', 'volume-slider-container');
    const slider = this._el('input', 'volume-slider') as HTMLInputElement;
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';

    const initialVol = this._audio ? this._audio.volume : 0.20;
    slider.value = String(Math.round(initialVol * 100));

    sliderContainer.appendChild(slider);
    volCtrl.appendChild(sliderContainer);

    const tooltip = this._el('span', 'volume-tooltip', slider.value + '%');
    volCtrl.appendChild(tooltip);

    const hint = this._el('span', 'volume-hint', 'M TO TOGGLE MUSIC');
    volCtrl.appendChild(hint);

    this._isMuted = initialVol === 0;
    this._savedVolBeforeMute = initialVol > 0 ? initialVol : 0.20;
    this._updateVolumeIcon(initialVol);

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!this._audio) return;
      if (this._isMuted) {
        const targetVol = this._savedVolBeforeMute;
        this._audio.setVolume(targetVol);
        slider.value = String(Math.round(targetVol * 100));
        tooltip.textContent = slider.value + '%';
        this._isMuted = false;
        this._updateVolumeIcon(targetVol);
      } else {
        this._savedVolBeforeMute = this._audio.volume > 0 ? this._audio.volume : 0.20;
        this._audio.setVolume(0);
        slider.value = '0';
        tooltip.textContent = '0%';
        this._isMuted = true;
        this._updateVolumeIcon(0);
      }
      this._audio.play('menuSelect');
    });

    slider.addEventListener('input', (e) => {
      e.stopPropagation();
      if (!this._audio) return;
      const target = e.target as HTMLInputElement;
      const val = parseFloat(target.value) / 100;
      this._audio.setVolume(val);
      tooltip.textContent = target.value + '%';
      if (val > 0) {
        this._isMuted = false;
        this._savedVolBeforeMute = val;
      } else {
        this._isMuted = true;
      }
      this._updateVolumeIcon(val);
    });

    slider.addEventListener('focus', () => {
      sliderContainer.classList.add('active');
    });
    slider.addEventListener('blur', () => {
      sliderContainer.classList.remove('active');
    });
  }

  private _updateVolumeIcon(vol: number): void {
    const svg = document.getElementById('volume-svg-icon');
    if (!svg) return;
    if (vol === 0) {
      svg.innerHTML = `<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`;
    } else if (vol < 0.25) {
      svg.innerHTML = `<path d="M7 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>`;
    } else {
      svg.innerHTML = `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`;
    }
  }

  private _el(tag: string, cls?: string, text?: string): HTMLElement {
    const el = document.createElement(tag);
    if (cls)  el.className = cls;
    if (text) el.textContent = text;
    return el;
  }
}
