import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { InputManager, Action } from './InputManager.ts';

describe('InputManager', () => {
  let listeners: { keydown: Function[]; keyup: Function[] };
  let mockWindow: any;

  beforeEach(() => {
    listeners = {
      keydown: [],
      keyup: [],
    };

    mockWindow = {
      addEventListener: vi.fn((event: 'keydown' | 'keyup', cb: Function) => {
        listeners[event]?.push(cb);
      }),
      removeEventListener: vi.fn((event: 'keydown' | 'keyup', cb: Function) => {
        if (listeners[event]) {
          listeners[event] = listeners[event].filter((item) => item !== cb);
        }
      }),
    };

    vi.stubGlobal('window', mockWindow);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const triggerKeyDown = (key: string) => {
    const event = {
      key,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    listeners.keydown.forEach((cb) => cb(event));
    return event;
  };

  const triggerKeyUp = (key: string) => {
    const event = {
      key,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;

    listeners.keyup.forEach((cb) => cb(event));
    return event;
  };

  it('should initialize with no keys down or pressed', () => {
    const input = new InputManager();

    // Check all actions
    Object.values(Action).forEach((action) => {
      expect(input.isDown(action)).toBe(false);
      expect(input.wasJustPressed(action)).toBe(false);
    });

    // Check event listeners registration
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(mockWindow.addEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));

    input.destroy();
  });

  it('should handle keydown and keyup for mapped keys', () => {
    const input = new InputManager();

    // Fire keydown for ArrowUp (mapped to Action.UP)
    const eventDown = triggerKeyDown('ArrowUp');
    expect(eventDown.preventDefault).toHaveBeenCalled();
    expect(input.isDown(Action.UP)).toBe(true);
    expect(input.wasJustPressed(Action.UP)).toBe(true);

    // If key is triggered again, isDown and wasJustPressed remain true
    const eventDownAgain = triggerKeyDown('ArrowUp');
    expect(eventDownAgain.preventDefault).toHaveBeenCalled();
    expect(input.isDown(Action.UP)).toBe(true);
    expect(input.wasJustPressed(Action.UP)).toBe(true);

    // Fire keyup for ArrowUp
    const eventUp = triggerKeyUp('ArrowUp');
    expect(eventUp.preventDefault).toHaveBeenCalled();
    expect(input.isDown(Action.UP)).toBe(false);
    expect(input.wasJustPressed(Action.UP)).toBe(true); // remains pressed until update()

    input.destroy();
  });

  it('should handle update() to clear wasJustPressed state while keeping isDown true', () => {
    const input = new InputManager();

    // Key down
    triggerKeyDown('w'); // mapped to Action.UP
    expect(input.isDown(Action.UP)).toBe(true);
    expect(input.wasJustPressed(Action.UP)).toBe(true);

    // Call update
    input.update();
    expect(input.isDown(Action.UP)).toBe(true);
    expect(input.wasJustPressed(Action.UP)).toBe(false);

    // Key up
    triggerKeyUp('w');
    expect(input.isDown(Action.UP)).toBe(false);
    expect(input.wasJustPressed(Action.UP)).toBe(false);

    input.destroy();
  });

  it('should ignore non-mapped keys', () => {
    const input = new InputManager();

    // Fire keydown for non-mapped key 'x'
    const eventDown = triggerKeyDown('x');
    expect(eventDown.preventDefault).not.toHaveBeenCalled();

    Object.values(Action).forEach((action) => {
      expect(input.isDown(action)).toBe(false);
      expect(input.wasJustPressed(action)).toBe(false);
    });

    // Fire keyup for non-mapped key 'x'
    const eventUp = triggerKeyUp('x');
    expect(eventUp.preventDefault).not.toHaveBeenCalled();

    input.destroy();
  });

  it('should correctly destroy and remove event listeners', () => {
    const input = new InputManager();

    expect(listeners.keydown.length).toBe(1);
    expect(listeners.keyup.length).toBe(1);

    input.destroy();

    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(mockWindow.removeEventListener).toHaveBeenCalledWith('keyup', expect.any(Function));
    expect(listeners.keydown.length).toBe(0);
    expect(listeners.keyup.length).toBe(0);
  });

  it('should map all keys in KEY_MAP to their correct Action', () => {
    const expectedMappings: { [key: string]: string } = {
      ArrowUp: Action.UP,
      w: Action.UP,
      W: Action.UP,
      ArrowDown: Action.DOWN,
      s: Action.DOWN,
      S: Action.DOWN,
      ArrowLeft: Action.LEFT,
      a: Action.LEFT,
      A: Action.LEFT,
      ArrowRight: Action.RIGHT,
      d: Action.RIGHT,
      D: Action.RIGHT,
      ' ': Action.FIRE,
      Enter: Action.CONFIRM,
      Escape: Action.PAUSE,
      p: Action.PAUSE,
      P: Action.PAUSE,
      v: Action.VIEWER,
      V: Action.VIEWER,
      Tab: Action.MODE,
      m: Action.TOGGLE_MUSIC,
      M: Action.TOGGLE_MUSIC,
    };

    for (const [key, expectedAction] of Object.entries(expectedMappings)) {
      const input = new InputManager();
      triggerKeyDown(key);
      expect(input.isDown(expectedAction as any)).toBe(true);
      expect(input.wasJustPressed(expectedAction as any)).toBe(true);
      input.destroy();
    }
  });
});
