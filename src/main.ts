import './style.css';
import { Game } from './Game.ts';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const uiOverlay = document.getElementById('ui-overlay') as HTMLElement;

const game = new Game(canvas, uiOverlay);
game.start();
