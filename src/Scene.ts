import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GAME_WIDTH, GAME_HEIGHT } from './constants.ts';
import { RenderCategory, UserDataKey } from './types.ts';


import { ProjectileInstancer } from './systems/ProjectileInstancer.ts';

const ChromaShader = {
  uniforms: {
    tDiffuse: { value: null },
    uOffset:  { value: 0.003 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uOffset;
    varying vec2 vUv;
    void main() {
      vec2 dir    = vUv - 0.5;
      vec2 offset = dir * uOffset;
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
};

export class Scene {
  readonly renderer: THREE.WebGLRenderer;
  readonly camera: THREE.OrthographicCamera;
  private scene: THREE.Scene;
  private cameraGroup: THREE.Group;
  private _tilted: boolean;
  private _scale: number;
  private _flashTimer: number;
  private _flashDur: number;
  private _flashMesh!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private _composer!: EffectComposer;
  private _projectileInstancer: ProjectileInstancer;
  private _activeBullets: Set<THREE.Object3D>;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.info.autoReset = false;

    const hw = GAME_WIDTH / 2;
    const hh = GAME_HEIGHT / 2;
    this.camera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, -1000, 1000);
    this.camera.position.z = 100;

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.32;
    pmrem.dispose();

    // Create a camera group for axonometric tilt and local shake support
    this.cameraGroup = new THREE.Group();
    this.cameraGroup.add(this.camera);
    this.scene.add(this.cameraGroup);

    this._tilted = false;

    // Saturated ambient light to keep secondary surfaces and shadows beautifully colored
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.44);
    this.scene.add(ambientLight);

    // Front-top-right directional light to uniformly light the broad side-profiles of all ships across the screen
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.68);
    dirLight.position.set(80, 120, 600);
    this.scene.add(dirLight);

    this._scale      = 1;
    this._flashTimer = 0;
    this._flashDur   = 0;
    const flashGeo = new THREE.PlaneGeometry(GAME_WIDTH * 3, GAME_HEIGHT * 3);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthWrite: false,
    });
    this._flashMesh = new THREE.Mesh(flashGeo, flashMat);
    this._flashMesh.position.z = 500;
    this._flashMesh.visible = false;
    this.scene.add(this._flashMesh);

    this._resize();

    const w = Math.floor(GAME_WIDTH  * this._scale);
    const h = Math.floor(GAME_HEIGHT * this._scale);

    this._composer = new EffectComposer(this.renderer);
    this._composer.addPass(new RenderPass(this.scene, this.camera));

    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.34, 0.32, 0.56);
    this._composer.addPass(bloom);

    const chroma = new ShaderPass(ChromaShader);
    this._composer.addPass(chroma);

    this._projectileInstancer = new ProjectileInstancer(this.scene);
    this._activeBullets = new Set();

    window.addEventListener('resize', () => this._resize());
  }

  private _resize(): void {
    const scale = Math.min(window.innerWidth / GAME_WIDTH, window.innerHeight / GAME_HEIGHT);
    this._scale = scale;
    const w = Math.floor(GAME_WIDTH  * scale);
    const h = Math.floor(GAME_HEIGHT * scale);
    this.renderer.setSize(w, h, false);
    const canvas = this.renderer.domElement;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    this._composer?.setSize(w, h);
  }

  add(object: THREE.Object3D): void {
    if (object.userData[UserDataKey.RENDER_CATEGORY] === RenderCategory.BULLET) {
      this._activeBullets.add(object);
    } else {
      this.scene.add(object);
    }
  }

  remove(object: THREE.Object3D): void {
    if (object.userData[UserDataKey.RENDER_CATEGORY] === RenderCategory.BULLET) {
      this._activeBullets.delete(object);
    } else {
      this.scene.remove(object);
    }
  }

  setClearAlpha(alpha: number): void {
    this.renderer.setClearColor(0x000000, alpha);
  }

  setTilted(tilted: boolean): void {
    this._tilted = tilted;
    if (tilted) {
      // Axonometric tilt: look slightly from the top-left (rotation around X and Y)
      this.cameraGroup.rotation.x = -0.15;
      this.cameraGroup.rotation.y = -0.22;
    } else {
      this.cameraGroup.rotation.set(0, 0, 0);
    }
  }

  /** White screen flash — opacity fades from 0.85 to 0 over `duration` seconds. */
  flash(duration: number): void {
    this._flashMesh.material.opacity = 0.85;
    this._flashMesh.visible = true;
    this._flashTimer = 0;
    this._flashDur   = duration;
  }

  render(dt: number = 0): void {
    this.renderer.info.reset();

    // 1. Process active bullets through ProjectileInstancer
    this._projectileInstancer.beginFrame();
    this._activeBullets.forEach((bullet) => {
      this._projectileInstancer.addBullet(bullet);
    });
    this._projectileInstancer.endFrame();

    // 2. Main render logic
    if (this._flashMesh.visible) {
      this._flashTimer += dt;
      const t = Math.min(this._flashTimer / this._flashDur, 1);
      if (t >= 1) {
        this._flashMesh.visible = false;
        this._flashMesh.material.opacity = 0;
      } else {
        this._flashMesh.material.opacity = 0.85 * (1 - t);
      }
    }
    
    if (this._tilted) {
      this._composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  getRenderInfo() {
    return this.renderer.info.render;
  }

  getSceneObjectStats() {
    const byCategory: Record<string, number> = {};
    const byDetail: Record<string, number> = {};
    let total = 0;

    this.scene.traverse((object) => {
      if (!this._isRenderable(object) || !this._isEffectivelyVisible(object)) return;

      const category = this._findRenderMetadata(object, 'renderCategory') ?? RenderCategory.UNCATEGORIZED;
      const detail = this._findRenderMetadata(object, 'renderDetail');
      const units = this._estimateRenderUnits(object);

      byCategory[category] = (byCategory[category] ?? 0) + units;
      if (detail) byDetail[detail] = (byDetail[detail] ?? 0) + units;
      total += units;
    });

    return { total, byCategory, byDetail };
  }

  private _isRenderable(object: THREE.Object3D): boolean {
    return (
      object instanceof THREE.Mesh ||
      object instanceof THREE.Line ||
      object instanceof THREE.Points ||
      object instanceof THREE.Sprite
    );
  }

  private _isEffectivelyVisible(object: THREE.Object3D): boolean {
    let cur: THREE.Object3D | null = object;
    while (cur) {
      if (!cur.visible) return false;
      cur = cur.parent;
    }
    return true;
  }

  private _estimateRenderUnits(object: THREE.Object3D): number {
    if (object instanceof THREE.Mesh && Array.isArray(object.material)) {
      return Math.max(1, object.material.length);
    }
    return 1;
  }

  private _findRenderMetadata(object: THREE.Object3D, key: 'renderCategory' | 'renderDetail'): RenderCategory | string | undefined {
    let cur: THREE.Object3D | null = object;
    while (cur) {
      const value = cur.userData[key] as RenderCategory | string | undefined;
      if (value) return value;
      cur = cur.parent;
    }
    return undefined;
  }

  get scale() { return this._scale; }
}
