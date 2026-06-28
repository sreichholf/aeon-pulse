import * as THREE from 'three';
import {
  createHeartseerModelInstance,
  preloadHeartseerModel,
  type HeartseerSockets,
} from '../entities/HeartseerModel.ts';

type SocketKey = keyof HeartseerSockets;

const SOCKET_COLORS: Record<SocketKey, number> = {
  heart: 0xff4b79,
  core: 0x67f5ea,
  muzzleUpper: 0xffb347,
  muzzleLower: 0xff8c42,
  minionUpper: 0x9bff66,
  minionLower: 0xb983ff,
};

const SOCKET_LABELS: Record<SocketKey, string> = {
  heart: 'Heart / Eye',
  core: 'Core',
  muzzleUpper: 'Muzzle Upper',
  muzzleLower: 'Muzzle Lower',
  minionUpper: 'Minion Upper',
  minionLower: 'Minion Lower',
};

interface SocketUi {
  label: HTMLDivElement;
  readout: HTMLDivElement;
  marker: THREE.Object3D;
  tether: THREE.Line;
}

export class HeartseerSocketPreview {
  private _canvas: HTMLCanvasElement;
  private _overlay: HTMLElement;
  private _renderer: THREE.WebGLRenderer;
  private _scene: THREE.Scene;
  private _camera: THREE.PerspectiveCamera;
  private _root: THREE.Group;
  private _socketLayer: THREE.Group;
  private _ui: HTMLDivElement;
  private _socketUis: Partial<Record<SocketKey, SocketUi>>;
  private _sockets: HeartseerSockets | null;
  private _frameHandle = 0;
  private _clock = new THREE.Clock();
  private _time = 0;
  private _dragging = false;
  private _lastPointer = new THREE.Vector2();
  private _yaw = -0.18;
  private _pitch = -0.08;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    this._canvas = canvas;
    this._overlay = overlay;
    this._renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this._renderer.setClearColor(0x06111f, 1);

    this._scene = new THREE.Scene();
    this._scene.fog = new THREE.Fog(0x06111f, 650, 1200);

    this._camera = new THREE.PerspectiveCamera(32, 1, 0.1, 2000);
    this._camera.position.set(0, 20, 560);

    this._root = new THREE.Group();
    this._socketLayer = new THREE.Group();
    this._ui = document.createElement('div');
    this._socketUis = {};
    this._sockets = null;

    this._buildScene();
    this._mountUi();
    this._bindEvents();
    this._resize();
    void this._load();
    this._frameHandle = window.requestAnimationFrame(this._tick);
  }

  private _buildScene(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.65);
    this._scene.add(ambient);

    const key = new THREE.DirectionalLight(0xfff2dd, 1.25);
    key.position.set(140, 180, 260);
    this._scene.add(key);

    const rim = new THREE.DirectionalLight(0x6fd7ff, 0.55);
    rim.position.set(-180, 60, -220);
    this._scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(300, 64),
      new THREE.MeshBasicMaterial({
        color: 0x0d2034,
        transparent: true,
        opacity: 0.42,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -100;
    this._scene.add(floor);

    this._scene.add(this._root);
    this._scene.add(this._socketLayer);
  }

  private _mountUi(): void {
    this._overlay.innerHTML = '';
    this._overlay.style.pointerEvents = 'auto';

    this._ui.className = 'heartseer-socket-preview';
    this._ui.innerHTML = `
      <div class="heartseer-socket-preview__panel">
        <h1>Heartseer Socket Preview</h1>
        <p>Route: <code>?heartseerSockets=1</code></p>
        <p>Drag to orbit. Wheel to zoom.</p>
        <div class="heartseer-socket-preview__readouts"></div>
      </div>
    `;
    this._overlay.appendChild(this._ui);
  }

  private _bindEvents(): void {
    window.addEventListener('resize', this._resize);
    this._canvas.addEventListener('pointerdown', this._onPointerDown);
    window.addEventListener('pointermove', this._onPointerMove);
    window.addEventListener('pointerup', this._onPointerUp);
    this._canvas.addEventListener('wheel', this._onWheel, { passive: false });
  }

  private async _load(): Promise<void> {
    const source = await preloadHeartseerModel();
    const instance = createHeartseerModelInstance(source);
    instance.root.scale.multiplyScalar(0.95);
    this._root.add(instance.root);
    this._sockets = instance.sockets;
    this._createSocketMarkers(instance.sockets);
  }

  private _createSocketMarkers(sockets: HeartseerSockets): void {
    const readouts = this._ui.querySelector('.heartseer-socket-preview__readouts');
    if (!(readouts instanceof HTMLDivElement)) return;
    readouts.innerHTML = '';

    for (const key of Object.keys(sockets) as SocketKey[]) {
      const socket = sockets[key];
      const color = SOCKET_COLORS[key];

      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(6, 18, 18),
        new THREE.MeshBasicMaterial({ color, depthTest: false }),
      );
      marker.renderOrder = 1000;
      this._socketLayer.add(marker);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(14, 1.1, 8, 32),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false }),
      );
      ring.renderOrder = 1000;
      ring.rotation.x = Math.PI / 2;
      marker.add(ring);

      const stem = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 22, 0)]),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 }),
      );
      marker.add(stem);

      const tether = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]),
        new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.5, depthTest: false }),
      );
      tether.renderOrder = 999;
      this._socketLayer.add(tether);

      const label = document.createElement('div');
      label.className = 'heartseer-socket-preview__label';
      label.style.borderColor = `#${color.toString(16).padStart(6, '0')}`;
      label.textContent = SOCKET_LABELS[key];
      this._overlay.appendChild(label);

      const readout = document.createElement('div');
      readout.className = 'heartseer-socket-preview__readout';
      readout.style.color = `#${color.toString(16).padStart(6, '0')}`;
      readouts.appendChild(readout);

      this._socketUis[key] = { label, readout, marker, tether };
    }
  }

  private _tick = (): void => {
    const dt = this._clock.getDelta();
    this._time += dt;

    this._root.rotation.y += (this._yaw - this._root.rotation.y) * Math.min(1, dt * 8);
    this._root.rotation.x += (this._pitch - this._root.rotation.x) * Math.min(1, dt * 8);

    for (const key of Object.keys(this._socketUis) as SocketKey[]) {
      const ui = this._socketUis[key];
      const socket = this._sockets?.[key];
      if (!ui || !socket) continue;

      ui.marker.scale.setScalar(1 + Math.sin(this._time * 3.2 + key.length) * 0.08);

      const world = new THREE.Vector3();
      const markerWorld = new THREE.Vector3();
      const pullDir = new THREE.Vector3();
      socket.getWorldPosition(world);
      pullDir.subVectors(this._camera.position, world).normalize();
      markerWorld.copy(world).addScaledVector(pullDir, 14);
      ui.marker.position.copy(markerWorld);

      const tetherPositions = (ui.tether.geometry as THREE.BufferGeometry).attributes.position as THREE.BufferAttribute;
      tetherPositions.setXYZ(0, world.x, world.y, world.z);
      tetherPositions.setXYZ(1, markerWorld.x, markerWorld.y, markerWorld.z);
      tetherPositions.needsUpdate = true;

      const screen = markerWorld.clone().project(this._camera);
      const x = (screen.x * 0.5 + 0.5) * this._canvas.clientWidth;
      const y = (-screen.y * 0.5 + 0.5) * this._canvas.clientHeight;

      ui.label.style.transform = `translate(${x + 14}px, ${y - 12}px)`;
      ui.readout.textContent = `${SOCKET_LABELS[key]}  x:${socket.position.x.toFixed(1)} y:${socket.position.y.toFixed(1)} z:${socket.position.z.toFixed(1)}`;
    }

    this._renderer.render(this._scene, this._camera);
    this._frameHandle = window.requestAnimationFrame(this._tick);
  };

  private _resize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this._renderer.setSize(width, height, false);
    this._camera.aspect = width / Math.max(1, height);
    this._camera.updateProjectionMatrix();
  };

  private _onPointerDown = (event: PointerEvent): void => {
    this._dragging = true;
    this._lastPointer.set(event.clientX, event.clientY);
  };

  private _onPointerMove = (event: PointerEvent): void => {
    if (!this._dragging) return;
    const dx = event.clientX - this._lastPointer.x;
    const dy = event.clientY - this._lastPointer.y;
    this._lastPointer.set(event.clientX, event.clientY);
    this._yaw += dx * 0.01;
    this._pitch = THREE.MathUtils.clamp(this._pitch + dy * 0.008, -0.7, 0.5);
  };

  private _onPointerUp = (): void => {
    this._dragging = false;
  };

  private _onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this._camera.position.z = THREE.MathUtils.clamp(this._camera.position.z + event.deltaY * 0.15, 280, 860);
  };
}
