import './style.css';
import { Game } from './Game.ts';
import { HeartseerSocketPreview } from './debug/HeartseerSocketPreview.ts';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiOverlay = document.getElementById('ui-overlay') as HTMLElement;

const params = new URLSearchParams(window.location.search);

if (params.get('heartseerSockets') === '1') {
  const preview = new HeartseerSocketPreview(canvas, uiOverlay);
  (window as any).heartseerSocketPreview = preview;
} else {
  const game = new Game(canvas, uiOverlay);
  (window as any).game = game;
  game.start();
}
