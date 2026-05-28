// Maps raw keys to logical actions. Add a GamepadManager with the same
// interface (isDown/wasJustPressed/update) to support controllers later.

export const Action = {
  UP:      'UP',
  DOWN:    'DOWN',
  LEFT:    'LEFT',
  RIGHT:   'RIGHT',
  FIRE:    'FIRE',
  CONFIRM: 'CONFIRM',
  PAUSE:   'PAUSE',
  VIEWER:  'VIEWER',
  MODE:    'MODE',
  TOGGLE_MUSIC: 'TOGGLE_MUSIC',
} as const;

export type ActionType = typeof Action[keyof typeof Action];

const KEY_MAP: Partial<Record<string, ActionType>> = {
  ArrowUp:    Action.UP,
  w:          Action.UP,
  W:          Action.UP,
  ArrowDown:  Action.DOWN,
  s:          Action.DOWN,
  S:          Action.DOWN,
  ArrowLeft:  Action.LEFT,
  a:          Action.LEFT,
  A:          Action.LEFT,
  ArrowRight: Action.RIGHT,
  d:          Action.RIGHT,
  D:          Action.RIGHT,
  ' ':        Action.FIRE,
  Enter:      Action.CONFIRM,
  Escape:     Action.PAUSE,
  p:          Action.PAUSE,
  P:          Action.PAUSE,
  v:          Action.VIEWER,
  V:          Action.VIEWER,
  Tab:        Action.MODE,
  m:          Action.TOGGLE_MUSIC,
  M:          Action.TOGGLE_MUSIC,
};

export class InputManager {
  private _down: Set<ActionType>;
  private _pressed: Set<ActionType>;
  private _keyDownHandler: (e: KeyboardEvent) => void;
  private _keyUpHandler: (e: KeyboardEvent) => void;

  constructor() {
    this._down    = new Set();   // actions currently held
    this._pressed = new Set();   // actions pressed this frame (cleared each update)

    this._keyDownHandler = (e) => this._onKeyDown(e);
    this._keyUpHandler   = (e) => this._onKeyUp(e);
    window.addEventListener('keydown', this._keyDownHandler);
    window.addEventListener('keyup',   this._keyUpHandler);
  }

  private _onKeyDown(e: KeyboardEvent): void {
    const action = KEY_MAP[e.key];
    if (!action) return;
    e.preventDefault();
    if (!this._down.has(action)) {
      this._pressed.add(action);
    }
    this._down.add(action);
  }

  private _onKeyUp(e: KeyboardEvent): void {
    const action = KEY_MAP[e.key];
    if (!action) return;
    e.preventDefault();
    this._down.delete(action);
  }

  /** True while the action key is held. */
  isDown(action: ActionType): boolean {
    return this._down.has(action);
  }

  /** True only on the first frame the action key is pressed. */
  wasJustPressed(action: ActionType): boolean {
    return this._pressed.has(action);
  }

  /** Call once per frame after all input checks to clear per-frame state. */
  update(): void {
    this._pressed.clear();
  }

  destroy(): void {
    window.removeEventListener('keydown', this._keyDownHandler);
    window.removeEventListener('keyup',   this._keyUpHandler);
  }
}
