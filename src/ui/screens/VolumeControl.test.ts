import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VolumeControl } from './VolumeControl.ts';

class MockClassList {
  private _classes = new Set<string>();

  add(...names: string[]): void {
    for (const name of names) this._classes.add(name);
  }

  remove(...names: string[]): void {
    for (const name of names) this._classes.delete(name);
  }

  toggle(name: string, force?: boolean): boolean {
    if (force === true) {
      this._classes.add(name);
      return true;
    }
    if (force === false) {
      this._classes.delete(name);
      return false;
    }
    if (this._classes.has(name)) {
      this._classes.delete(name);
      return false;
    }
    this._classes.add(name);
    return true;
  }

  contains(name: string): boolean {
    return this._classes.has(name);
  }
}

class MockElement {
  id = '';
  className = '';
  textContent: string | null = null;
  innerHTML = '';
  children: MockElement[] = [];
  style: Record<string, string> = {};
  type = '';
  min = '';
  max = '';
  value = '';
  listeners = new Map<string, Array<(event: any) => void>>();
  classList = new MockClassList();

  constructor(readonly tagName: string, private readonly _document: MockDocument) {}

  appendChild(child: MockElement): MockElement {
    this.children.push(child);
    if (child.id) this._document.register(child);
    return child;
  }

  addEventListener(type: string, listener: (event: any) => void): void {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type: string, event: any = {}): void {
    const listeners = this.listeners.get(type) ?? [];
    for (const listener of listeners) listener(event);
  }
}

class MockDocument {
  private _elementsById = new Map<string, MockElement>();

  createElement(tag: string): MockElement {
    return new MockElement(tag, this);
  }

  getElementById(id: string): MockElement | null {
    return this._elementsById.get(id) ?? null;
  }

  register(element: MockElement): void {
    if (element.id) this._elementsById.set(element.id, element);
  }
}

describe('VolumeControl', () => {
  let documentMock: MockDocument;

  beforeEach(() => {
    documentMock = new MockDocument();
    vi.stubGlobal('document', documentMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows the ordinary music-toggle hint and current volume on startup', () => {
    const audio = {
      volume: 0.35,
      setVolume: vi.fn(),
      play: vi.fn(),
    };

    const control = new VolumeControl(audio as any);

    const [, sliderContainer, tooltip, hint] = control.el.children as MockElement[];
    const [slider] = sliderContainer.children;

    expect(control.el.id).toBe('volume-control');
    expect(slider.value).toBe('35');
    expect(tooltip.textContent).toBe('35%');
    expect(hint.textContent).toBe('M TO TOGGLE MUSIC');
  });

  it('toggles volume to zero and restores the saved value via the button', () => {
    let volume = 0.4;
    const audio = {
      get volume() {
        return volume;
      },
      setVolume: vi.fn((next: number) => {
        volume = next;
      }),
      play: vi.fn(),
    };

    const control = new VolumeControl(audio as any);
    const [button, sliderContainer, tooltip] = control.el.children as MockElement[];
    const [slider] = sliderContainer.children;

    button.dispatch('click', { stopPropagation: vi.fn() });
    expect(audio.setVolume).toHaveBeenNthCalledWith(1, 0);
    expect(slider.value).toBe('0');
    expect(tooltip.textContent).toBe('0%');
    expect(audio.play).toHaveBeenNthCalledWith(1, 'menuSelect');

    button.dispatch('click', { stopPropagation: vi.fn() });
    expect(audio.setVolume).toHaveBeenNthCalledWith(2, 0.4);
    expect(slider.value).toBe('40');
    expect(tooltip.textContent).toBe('40%');
    expect(audio.play).toHaveBeenNthCalledWith(2, 'menuSelect');
  });

  it('updates audio volume from the slider and tracks mute state', () => {
    let volume = 0.2;
    const audio = {
      get volume() {
        return volume;
      },
      setVolume: vi.fn((next: number) => {
        volume = next;
      }),
      play: vi.fn(),
    };

    const control = new VolumeControl(audio as any);
    const [, sliderContainer, tooltip] = control.el.children as MockElement[];
    const [slider] = sliderContainer.children;

    slider.value = '0';
    slider.dispatch('input', {
      stopPropagation: vi.fn(),
      target: slider,
    });
    expect(audio.setVolume).toHaveBeenNthCalledWith(1, 0);
    expect(tooltip.textContent).toBe('0%');

    slider.value = '75';
    slider.dispatch('input', {
      stopPropagation: vi.fn(),
      target: slider,
    });
    expect(audio.setVolume).toHaveBeenNthCalledWith(2, 0.75);
    expect(tooltip.textContent).toBe('75%');
  });

  it.todo('shows explicit test-audio hint text when the run starts with ?testAudio=off');
  it.todo('uses the existing control surface to lift the full browser-test audio gate for the current run');
});
