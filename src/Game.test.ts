import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from './Game.ts';
import { GameState } from './types.ts';
import { Action } from './systems/InputManager.ts';

describe('Game._updatePlaying ARCH-7 priority rule', () => {
  let game: any;

  beforeEach(() => {
    game = Object.create(Game.prototype);
    game.input = { wasJustPressed: vi.fn().mockReturnValue(false) };
    game.ui = { updateHUD: vi.fn() };
    game.score = { isGameOver: false };
    game._run = {
      tick: vi.fn(),
      hasPendingLevelComplete: false,
      getHUDSnapshot: vi.fn().mockReturnValue({}),
    };
    vi.spyOn(game, 'onLevelComplete').mockImplementation(() => {});
    vi.spyOn(game, '_setState').mockImplementation(() => {});
  });

  it('level completion preempts game-over when both flags are true after tick', () => {
    game._run.hasPendingLevelComplete = true;
    game.score.isGameOver = true;

    game._updatePlaying(0.016);

    expect(game._run.tick).toHaveBeenCalledWith(0.016);
    expect(game.onLevelComplete).toHaveBeenCalledOnce();
    expect(game._setState).not.toHaveBeenCalledWith(GameState.GAME_OVER);
    expect(game.ui.updateHUD).not.toHaveBeenCalled();
  });

  it('transitions to game-over when only score.isGameOver is true', () => {
    game._run.hasPendingLevelComplete = false;
    game.score.isGameOver = true;

    game._updatePlaying(0.016);

    expect(game._run.tick).toHaveBeenCalledWith(0.016);
    expect(game.onLevelComplete).not.toHaveBeenCalled();
    expect(game._setState).toHaveBeenCalledOnce();
    expect(game._setState).toHaveBeenCalledWith(GameState.GAME_OVER);
    expect(game.ui.updateHUD).toHaveBeenCalledOnce();
  });

  it('continues normally when neither flag is set', () => {
    game._run.hasPendingLevelComplete = false;
    game.score.isGameOver = false;

    game._updatePlaying(0.016);

    expect(game.onLevelComplete).not.toHaveBeenCalled();
    expect(game._setState).not.toHaveBeenCalled();
    expect(game.ui.updateHUD).toHaveBeenCalledOnce();
  });
});
