import * as THREE from 'three';
import { Enemy, HALF_W, HALF_H } from './Enemy.ts';
import { Bullet } from './Bullet.ts';
import { BulletType, type GetPositionFn, type IAudio, type IScene } from '../types.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

function ensureNonIndexed(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const cloned = geo.index ? geo.toNonIndexed() : geo.clone();
  // Strip UV attributes to avoid BufferGeometryUtils attribute mismatch on custom shapes
  if (cloned.hasAttribute && cloned.hasAttribute('uv')) {
    cloned.deleteAttribute('uv');
  } else if ((cloned as any).removeAttribute) {
    (cloned as any).removeAttribute('uv');
  } else if (cloned.attributes.uv) {
    delete cloned.attributes.uv;
  }
  return cloned;
}

function addVertexColor(geo: THREE.BufferGeometry, colorHex: number): void {
  const posAttr = geo.getAttribute('position');
  if (!posAttr) return;
  const count = posAttr.count;
  const colors = new Float32Array(count * 3);
  const color = new THREE.Color(colorHex);
  for (let i = 0; i < count; i++) {
    colors[i * 3]     = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
}

function createAirfoilWingGeometry(): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  
  const segmentsChord = 16;
  const segmentsSpan = 16;
  
  const vertices: number[] = [];
  const indices: number[] = [];
  
  const maxThickness = 2.8; // substantially thicker airfoil for heavy, robust 3D form
  
  for (let s = 0; s <= segmentsSpan; s++) {
    const v = s / segmentsSpan;
    const z = v * 24; // Wing half-span
    
    // Swept-back chord scaling
    // Root chord starts at X=-3 to X=10 (chord = 13)
    // Tip chord ends at X=13 to X=17 (chord = 4)
    const xLead = -3 + z * (16 / 24);
    const xTrail = 10 + z * (7 / 24);
    const chord = xTrail - xLead;
    
    const tipTaper = Math.max(0.15, 1.0 - v * 0.80);
    const localMaxThickness = maxThickness * tipTaper;
    
    for (let c = 0; c <= segmentsChord; c++) {
      const u = c / segmentsChord;
      const x = xLead + u * chord;
      
      // Aerodynamic airfoil cross-section (thick leading edge, thin sharp trailing edge)
      const thicknessFactor = 3.5 * Math.sqrt(u) * (1 - u);
      const yUpper = thicknessFactor * localMaxThickness * 0.5;
      const yLower = -yUpper;
      
      vertices.push(x, yUpper, z);
      vertices.push(x, yLower, z);
    }
  }
  
  for (let s = 0; s < segmentsSpan; s++) {
    for (let c = 0; c < segmentsChord; c++) {
      const currRow = s * (segmentsChord + 1);
      const nextRow = (s + 1) * (segmentsChord + 1);
      
      const i0_up = (currRow + c) * 2;
      const i0_dn = i0_up + 1;
      
      const i1_up = (currRow + c + 1) * 2;
      const i1_dn = i1_up + 1;
      
      const i2_up = (nextRow + c) * 2;
      const i2_dn = i2_up + 1;
      
      const i3_up = (nextRow + c + 1) * 2;
      const i3_dn = i3_up + 1;
      
      // Upper surface (CCW looking from +Y)
      indices.push(i0_up, i2_up, i1_up);
      indices.push(i1_up, i2_up, i3_up);
      
      // Lower surface (CCW looking from -Y)
      indices.push(i0_dn, i1_dn, i2_dn);
      indices.push(i1_dn, i3_dn, i2_dn);
    }
  }
  
  geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const SPEED         = 130;
const FIRE_INTERVAL = 2.5;
const PAUSE_DUR     = 0.30;
const HW = 30, HH = 34;

export class EnemyStraight extends Enemy {
  private _fireTimer: number;
  private _pausing: boolean;
  private _pauseTimer: number;
  private _lunging: boolean;
  private _lungeTimer: number;
  private _time: number;
  private _kickback: number;
  private _kickbackVel: number;
  private _engineScale: number;
  private _visorFlash: number;
  private _visorPulseTime: number;
  private _visorMat: THREE.MeshPhongMaterial | null = null;
  private _visualsGroup: THREE.Group | null = null;
  private _mainFlame: THREE.Mesh | null = null;
  private _leftGunPoint: THREE.Object3D | null = null;
  private _rightGunPoint: THREE.Object3D | null = null;

  constructor(
    scene: IScene,
    sprites: Record<string, THREE.Texture>,
    x: number,
    y: number,
    getPlayerPos: GetPositionFn,
    _audio: IAudio | null = null,
  ) {
    super(scene, sprites, null, 0, 0, HW, HH, x, y);
    this._hp           = 1;
    this.score         = 100;
    this._dropChance   = 0.07;
    this._getPlayerPos = getPlayerPos;
    this._fireTimer    = FIRE_INTERVAL * (0.4 + Math.random() * 0.6);
    this._pausing      = false;
    this._pauseTimer   = 0;
    this._lunging      = false;
    this._lungeTimer   = 0;

    // Animations states
    this._time           = 0;
    this._kickback       = 0;
    this._kickbackVel    = 0;
    this._engineScale    = 1.0;
    this._visorFlash     = 0.4;
    this._visorPulseTime = 0;

    this._displayName = 'Straight';
    this._mesh = this._build3DModel();
    this._scene.add(this._mesh);
  }

  get isSpaceShip(): boolean { return true; }

  _tick(dt: number): void {
    this._time += dt;
    this._visorPulseTime += dt;
    const pos = this._mesh!.position;

    // 1. Aiming, Pausing, and Lunging speed compensation logic
    let currentSpeed = SPEED;

    if (this._pausing) {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._pausing   = false;
        this._lunging   = true;
        this._lungeTimer = PAUSE_DUR;
      }
      // Visor warning flare & engine throttle-down
      this._visorFlash = THREE.MathUtils.lerp(this._visorFlash, 2.5, 8 * dt);
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 0.79, 10 * dt);
      currentSpeed = SPEED * 0.79;
    } else if (this._lunging) {
      this._lungeTimer -= dt;
      if (this._lungeTimer <= 0) {
        this._lunging = false;
        this._fireTimer = FIRE_INTERVAL;
      }
      // Visor returning to resting state & engine supercharged forward-lunge
      this._visorFlash = THREE.MathUtils.lerp(this._visorFlash, 0.4, 6 * dt);
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 1.21, 12 * dt);
      currentSpeed = SPEED * 1.21; // Forward lunge at 1.21x speed to fully compensate!
    } else {
      this._fireTimer -= dt;
      if (this._fireTimer <= 0 && pos.x < HALF_W - 60) {
        this._shootAtPlayer();
        this._pausing    = true;
        this._pauseTimer = PAUSE_DUR;
      }
      // Visor resting state & engine throttle-up
      this._visorFlash = THREE.MathUtils.lerp(this._visorFlash, 0.4, 6 * dt);
      this._engineScale = THREE.MathUtils.lerp(this._engineScale, 1.0, 8 * dt);
      currentSpeed = SPEED;
    }

    // Move left
    pos.x -= currentSpeed * dt;

    // Bounds clamping
    if (this.terrainBounds) {
      pos.y = Math.max(this.terrainBounds.bottom + HH, Math.min(this.terrainBounds.top - HH, pos.y));
    } else {
      pos.y = Math.max(-HALF_H + HH, Math.min(HALF_H - HH, pos.y));
    }

    // 2. Visor Emissive Pulse Animation
    if (this._visorMat) {
      const pulse = 1.0 + Math.sin(this._visorPulseTime * 25) * 0.35;
      const intensity = this._visorFlash * (this._pausing ? pulse : 1.0);
      this._visorMat.emissive.setRGB(0.9 * intensity, 0.08 * intensity, 0.08 * intensity);
    }

    // 3. Firing Spring Recoil Backlash (Underdamped Harmonic Oscillation)
    const k = 440; // Stiffness (doubled for 2x faster recovery)
    const c = 28;  // Damping (doubled to match — same shape, twice the speed)
    const force = -k * this._kickback - c * this._kickbackVel;
    this._kickbackVel += force * dt;
    this._kickback += this._kickbackVel * dt;
    if (this._visualsGroup) {
      this._visualsGroup.position.x = this._kickback;
    }

    // 4. Supersonic Jitter Thrusters
    const jitter = 1.0 + Math.sin(this._time * 40) * 0.20;
    const flameScale = this._engineScale * jitter;

    if (this._mainFlame) {
      this._mainFlame.scale.set(flameScale, this._engineScale, this._engineScale);
      this._mainFlame.visible = flameScale > 0.05;
    }

    // Subtle idle body wobble removed (too distracting at top-down angle)
  }

  _shootAtPlayer(): void {
    if (!this._getPlayerPos) return;

    // Force update matrix world of the visuals and main mesh so gun positions are 100% accurate.
    if (this._mesh) {
      this._mesh.updateMatrixWorld(true);
    }

    const leftWorldPos = new THREE.Vector3();
    const rightWorldPos = new THREE.Vector3();

    if (this._leftGunPoint && this._rightGunPoint) {
      this._leftGunPoint.getWorldPosition(leftWorldPos);
      this._rightGunPoint.getWorldPosition(rightWorldPos);
    } else {
      // Fallback to center if not initialized
      leftWorldPos.set(this.x, this.y, 0);
      rightWorldPos.set(this.x, this.y, 0);
    }

    // 50% target angle fire logic to occupy space with the shots
    const { x: px, y: py } = this._getPlayerPos();
    const targetAngle = Math.atan2(py - this.y, px - this.x);
    let diff = targetAngle - Math.PI;
    if (diff > Math.PI) diff -= 2 * Math.PI;
    if (diff < -Math.PI) diff += 2 * Math.PI;

    // Aim 50% of the deviation from forward straight-left facing
    const firedAngle = Math.PI + diff * 0.5;
    const speed = 260;
    const vx = Math.cos(firedAngle) * speed;
    const vy = Math.sin(firedAngle) * speed;

    // Spawning two parallel bullets
    const spawnLeft = { type: BulletType.ENEMY, x: leftWorldPos.x, y: leftWorldPos.y, vx, vy };
    const spawnRight = { type: BulletType.ENEMY, x: rightWorldPos.x, y: rightWorldPos.y, vx, vy };

    this._newBullets.push(
      this._projectileFactory?.(spawnLeft) ?? new Bullet(this._scene, this._sprites, BulletType.ENEMY, spawnLeft.x, spawnLeft.y, vx, vy),
      this._projectileFactory?.(spawnRight) ?? new Bullet(this._scene, this._sprites, BulletType.ENEMY, spawnRight.x, spawnRight.y, vx, vy)
    );

    this._kickback = 7.0;    // Brutal recoil slam to the right (+X)
    this._kickbackVel = -75.0; // Violent forward counter-lunge to the left (-X)
    this._visorPulseTime = 0;
    if (this._visorMat) {
      // Visor turns pure white-hot briefly upon firing
      this._visorMat.emissive.setRGB(3.0, 3.0, 3.0);
    }
  }

  private _build3DModel(): THREE.Group {
    const group = new THREE.Group();
    group.position.set(this._mesh!.position.x, this._mesh!.position.y, 0);

    // Visuals container to isolate dynamic kickback translation from position
    const visuals = new THREE.Group();
    group.add(visuals);
    this._visualsGroup = visuals;

    // --- Materials (Terran Fighter 07A V5 Design System) ---
    const shipMat = new THREE.MeshPhongMaterial({
      vertexColors: true,
      emissive: 0x0d111a,  // Very subtle self-illumination — just enough to lift shadows
      shininess: 28,       // Low shininess = broad soft highlight, not a blinding hot-spot
      specular: 0x3a4a5c,  // Muted blue-grey specular — metallic without blowing out
      flatShading: true,
    });

    shipMat.customProgramCacheKey = () => 'EnemyStraightDecalsV1';
    shipMat.onBeforeCompile = (shader) => {
      // 1. Vertex Shader Injection: Pass local positions
      shader.vertexShader = 'varying vec3 vLocalPosition;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vLocalPosition = position.xyz;`
      );

      // 2. Fragment Shader Injection: Add procedural decal drawing helpers at the GLOBAL scope
      shader.fragmentShader = `varying vec3 vLocalPosition;

      float getLine(float val, float target, float thickness) {
        return smoothstep(thickness, thickness * 0.4, abs(val - target));
      }

      float drawZero(vec2 uv) {
        float outer = step(abs(uv.x), 0.5) * step(abs(uv.y), 0.7);
        float inner = step(abs(uv.x), 0.25) * step(abs(uv.y), 0.45);
        float split = step(abs(uv.y), 0.1);
        return max(0.0, outer - inner - split);
      }

      float drawSeven(vec2 uv) {
        float top = step(abs(uv.y - 0.55), 0.15) * step(abs(uv.x), 0.5);
        float diag = step(abs(uv.x + uv.y * 0.6 - 0.1), 0.15) * step(abs(uv.y), 0.7);
        return max(0.0, max(top, diag));
      }\n` + shader.fragmentShader;

      // 3. Fragment Shader Injection: Draw panel lines, rivets, bird decals, and serial numbers (branchless!)
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>

        // --- 1. Procedural Panel Seams ---
        float panelLine = 0.0;

        // Lateral seams (made significantly thicker for visibility at scale)
        panelLine = max(panelLine, getLine(vLocalPosition.x, -6.0, 0.4));
        panelLine = max(panelLine, getLine(vLocalPosition.x, 1.0, 0.4));
        panelLine = max(panelLine, getLine(vLocalPosition.x, 6.0, 0.4));
        panelLine = max(panelLine, getLine(vLocalPosition.x, 12.0, 0.4));

        // Longitudinal seams
        panelLine = max(panelLine, getLine(abs(vLocalPosition.z), 2.8, 0.4));
        panelLine = max(panelLine, getLine(abs(vLocalPosition.z), 5.0, 0.4));
        panelLine = max(panelLine, getLine(abs(vLocalPosition.z), 11.5, 0.4));
        panelLine = max(panelLine, getLine(abs(vLocalPosition.z), 22.2, 0.4));

        // Swept wing panel lines (diagonal, branchless using step)
        float isWing = step(3.0, abs(vLocalPosition.z));
        float swept1 = abs(vLocalPosition.x - (2.5 + abs(vLocalPosition.z) * 0.5));
        panelLine = max(panelLine, smoothstep(0.4, 0.1, swept1) * isWing);
        
        float swept2 = abs(vLocalPosition.x - (-3.0 + abs(vLocalPosition.z) * 0.6));
        panelLine = max(panelLine, smoothstep(0.4, 0.1, swept2) * isWing);

        // Apply panel lines as a dark groove
        vec3 panelColor = diffuseColor.rgb * 0.35;
        diffuseColor.rgb = mix(diffuseColor.rgb, panelColor, panelLine * 0.9);

        // --- 2. Procedural Rivet Dots ---
        float rivetVal = 0.0;
        
        float isLongSeam = step(abs(abs(vLocalPosition.z) - 2.8), 0.5);
        float distX = abs(fract(vLocalPosition.x / 2.0 + 0.5) - 0.5) * 2.0;
        rivetVal = max(rivetVal, smoothstep(0.35, 0.1, distX) * isLongSeam);
        
        float isWingSeam = step(abs(abs(vLocalPosition.z) - 11.5), 0.5);
        float distWingX = abs(fract(vLocalPosition.x / 2.5 + 0.5) - 0.5) * 2.5;
        rivetVal = max(rivetVal, smoothstep(0.35, 0.1, distWingX) * isWingSeam);
        
        // Apply rivets as recessed dark dots
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.08, 0.1), rivetVal * 0.95);

        // --- 3. White Eagle Wing Decals (branchless!) ---
        float decalBird = 0.0;
        float inWingX = step(-3.0, vLocalPosition.x) * step(vLocalPosition.x, 8.0);
        float inWingZ = step(5.5, abs(vLocalPosition.z)) * step(abs(vLocalPosition.z), 17.5);
        
        // Scaled up by roughly 3.3x (multiplying coordinates by 0.3)
        vec2 pDecal = vec2(vLocalPosition.x - 2.5, abs(vLocalPosition.z) - 11.5) * 0.3;
        pDecal.x *= 1.2;
        float bodyDist = abs(pDecal.x) + abs(pDecal.y) * 2.0;
        float body = smoothstep(0.6, 0.4, bodyDist);

        float wingDist = abs(pDecal.y - (pDecal.x - 0.4) * 0.7);
        float wingLimit = step(pDecal.x, 1.8) * step(-1.2, pDecal.x);
        float wings = smoothstep(0.5, 0.3, wingDist) * wingLimit;

        decalBird = max(body, wings) * inWingX * inWingZ;
        
        // Paint bird decal in vibrant tactical white/off-white (only on base steel blue / grey parts, avoiding red trims)
        #ifdef USE_COLOR
        if (vColor.r < 0.8) {
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.98), decalBird * 0.9);
        }
        #else
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.98), decalBird * 0.9);
        #endif

        // --- 4. Engine Nacelle "07" Serial Number Decal (branchless!) ---
        float stencil = 0.0;
        float inEngineX = step(0.0, vLocalPosition.x) * step(vLocalPosition.x, 10.0);
        float inEngineZ = step(1.5, abs(vLocalPosition.z)) * step(abs(vLocalPosition.z), 4.5);
        
        vec2 uvDecal = vec2(vLocalPosition.x - 5.0, abs(vLocalPosition.z) - 2.8);
        
        // Scaled up by 4x (multiplying coordinates by 1.5 instead of 6.0)
        vec2 p0 = (uvDecal - vec2(-1.2, 0.0)) * 1.5;
        vec2 p7 = (uvDecal - vec2(1.2, 0.0)) * 1.5;
        
        stencil = (drawZero(p0) + drawSeven(p7)) * inEngineX * inEngineZ;
        
        // Paint engine serial number stencil in crisp tactical white/yellow
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.92, 0.55), stencil * 0.95);`
      );
    };



    const cockpitMat = new THREE.MeshPhongMaterial({
      color: 0x00d2ff, // Vibrant glowing cyan-blue canopy glass
      emissive: 0x002b4d,
      shininess: 120,
      specular: 0xdff9fb, // Bright turquoise glint
      transparent: true,
      opacity: 0.85,
      flatShading: true,
    });

    const visorMat = new THREE.MeshPhongMaterial({
      color: 0xff1a2c, // Glowing red tactical sensor visor under nose
      emissive: 0xaa0005,
      shininess: 100,
      specular: 0xff8899,
    });
    this._visorMat = visorMat;

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff5500, // Vibrant twin ion thruster orange-red flames
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    // --- 1. Fuselage Geometries (Stealth faceted 8-segmented shapes, flattened in Y) ---
    const bodyGeo = new THREE.CylinderGeometry(3.6, 5.0, 16, 8);
    bodyGeo.rotateZ(Math.PI / 2); // Lay along horizontal X-axis
    bodyGeo.scale(1, 0.6, 1.1);

    const noseGeo = new THREE.CylinderGeometry(0.8, 3.6, 12, 8);
    noseGeo.rotateZ(Math.PI / 2);
    noseGeo.scale(1, 0.6, 1.1);

    const rearGeo = new THREE.CylinderGeometry(5.0, 4.0, 6, 8);
    rearGeo.rotateZ(Math.PI / 2);
    rearGeo.scale(1, 0.6, 1.1);

    const noseTipGeo = new THREE.ConeGeometry(0.8, 3.5, 8);
    noseTipGeo.rotateZ(-Math.PI / 2); // Points forward (-X)
    noseTipGeo.scale(1, 0.6, 1.1);

    // --- 2. Center Engine Spine Ridge Geometry ---
    const ridgeGeo = new THREE.BoxGeometry(11, 1.8, 3.8);

    // --- 3. Air Intake Shoulder Fairings (The sweeping intake decks on nose sides) ---
    const shoulderLGeo = new THREE.BoxGeometry(8, 1.8, 3.5);
    const shoulderRGeo = new THREE.BoxGeometry(8, 1.8, 3.5);
    const lightLGeo = new THREE.BoxGeometry(3.0, 0.8, 0.4); // Glowing orange intake lights
    const lightRGeo = new THREE.BoxGeometry(3.0, 0.8, 0.4);

    // --- 4. Vertical Tail Fins (Stabilizers) standing on nacelles ---
    // Two-tone tail fins: split into carbon base and crimson top plate for perfect render-path color merging
    const finLeftBottomGeo = new THREE.BoxGeometry(4.0, 2.5, 0.4);
    const finLeftTopGeo = new THREE.BoxGeometry(3.0, 1.3, 0.4);
    const finRightBottomGeo = new THREE.BoxGeometry(4.0, 2.5, 0.4);
    const finRightTopGeo = new THREE.BoxGeometry(3.0, 1.3, 0.4);

    // --- 5. Copper fuel piping / mechanical conduits running along top deck ---
    const pipeLGeo = new THREE.CylinderGeometry(0.12, 0.12, 8, 4);
    pipeLGeo.rotateZ(Math.PI / 2);
    const pipeRGeo = new THREE.CylinderGeometry(0.12, 0.12, 8, 4);
    pipeRGeo.rotateZ(Math.PI / 2);
    const pipeOuterLGeo = new THREE.CylinderGeometry(0.12, 0.12, 8, 4);
    pipeOuterLGeo.rotateZ(Math.PI / 2);
    const pipeOuterRGeo = new THREE.CylinderGeometry(0.12, 0.12, 8, 4);
    pipeOuterRGeo.rotateZ(Math.PI / 2);

    // --- 6. Twin Engine Nacelles Geometries (Faceted 8-radial segments) ---
    // These sit proudly on top of the flat fuselage deck (Y = 2.2)
    const engineLeftGeo = new THREE.CylinderGeometry(1.8, 2.0, 12, 8);
    engineLeftGeo.rotateZ(Math.PI / 2);
    const engineRightGeo = new THREE.CylinderGeometry(1.8, 2.0, 12, 8);
    engineRightGeo.rotateZ(Math.PI / 2);

    const intakeLeftGeo = new THREE.CylinderGeometry(2.1, 1.8, 2.0, 8);
    intakeLeftGeo.rotateZ(Math.PI / 2);
    const intakeRightGeo = new THREE.CylinderGeometry(2.1, 1.8, 2.0, 8);
    intakeRightGeo.rotateZ(Math.PI / 2);

    const hubLeftGeo = new THREE.ConeGeometry(0.9, 1.4, 8);
    hubLeftGeo.rotateZ(-Math.PI / 2);
    const hubRightGeo = new THREE.ConeGeometry(0.9, 1.4, 8);
    hubRightGeo.rotateZ(-Math.PI / 2);

    const nozzleLeftGeo = new THREE.CylinderGeometry(1.8, 1.3, 2.8, 8);
    nozzleLeftGeo.rotateZ(Math.PI / 2);
    const nozzleRightGeo = new THREE.CylinderGeometry(1.8, 1.3, 2.8, 8);
    nozzleRightGeo.rotateZ(Math.PI / 2);

    // --- 4. Layered Swept-Back Delta Wings (Faceted shape extrusions) ---
    const wingShapeLeft = new THREE.Shape();
    wingShapeLeft.moveTo(10, 0);
    wingShapeLeft.lineTo(15, 23);
    wingShapeLeft.lineTo(11, 23);
    wingShapeLeft.lineTo(-3, 0);
    wingShapeLeft.closePath();

    const wingShapeRight = new THREE.Shape();
    wingShapeRight.moveTo(10, 0);
    wingShapeRight.lineTo(15, -23);
    wingShapeRight.lineTo(11, -23);
    wingShapeRight.lineTo(-3, 0);
    wingShapeRight.closePath();

    const extrudeWing = {
      depth: 1.8,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.6,
      bevelThickness: 0.6
    };

    const wingLGeo = new THREE.ExtrudeGeometry(wingShapeLeft, extrudeWing);
    wingLGeo.center();
    wingLGeo.rotateX(Math.PI / 2);
    const wingLCloned = ensureNonIndexed(wingLGeo);
    wingLCloned.translate(2.5, -0.4, 11.5);

    const wingRGeo = new THREE.ExtrudeGeometry(wingShapeRight, extrudeWing);
    wingRGeo.center();
    wingRGeo.rotateX(Math.PI / 2);
    const wingRCloned = ensureNonIndexed(wingRGeo);
    wingRCloned.translate(2.5, -0.4, -11.5);

    // Merge wings!
    const wingCloned = mergeGeometries([wingLCloned, wingRCloned]);

    // Thick wingtip pods (chunky boxes)
    const endplateLeftGeo = new THREE.BoxGeometry(8.0, 2.2, 1.8);
    const endplateRightGeo = new THREE.BoxGeometry(8.0, 2.2, 1.8);

    // Wingtips Vertical Winglets (The outer endplate fins from the Rear/Back Views!)
    const wingletLBottomGeo = new THREE.BoxGeometry(4.0, 2.0, 0.3);
    const wingletLTopGeo = new THREE.BoxGeometry(3.0, 1.0, 0.3);
    const wingletRBottomGeo = new THREE.BoxGeometry(4.0, 2.0, 0.3);
    const wingletRTopGeo = new THREE.BoxGeometry(3.0, 1.0, 0.3);

    // Wingtips Dual-Barrel Cannons (Attached seamlessly to leading wingtips)
    const gunLeftOuterGeo = new THREE.CylinderGeometry(0.3, 0.3, 7.5, 8);
    gunLeftOuterGeo.rotateZ(Math.PI / 2);
    const gunLeftInnerGeo = new THREE.CylinderGeometry(0.3, 0.3, 7.5, 8);
    gunLeftInnerGeo.rotateZ(Math.PI / 2);

    const gunRightOuterGeo = new THREE.CylinderGeometry(0.3, 0.3, 7.5, 8);
    gunRightOuterGeo.rotateZ(Math.PI / 2);
    const gunRightInnerGeo = new THREE.CylinderGeometry(0.3, 0.3, 7.5, 8);
    gunRightInnerGeo.rotateZ(Math.PI / 2);

    // Physically raised armor overlay plates (Crimson red, translated to sit proud of wing surface)
    const panelShapeLeft = new THREE.Shape();
    panelShapeLeft.moveTo(8, 2);
    panelShapeLeft.lineTo(13.5, 17);
    panelShapeLeft.lineTo(10.5, 17);
    panelShapeLeft.lineTo(1.5, 2);
    panelShapeLeft.closePath();

    const panelShapeRight = new THREE.Shape();
    panelShapeRight.moveTo(8, -2);
    panelShapeRight.lineTo(13.5, -17);
    panelShapeRight.lineTo(10.5, -17);
    panelShapeRight.lineTo(1.5, -2);
    panelShapeRight.closePath();

    const extrudePanel = {
      depth: 0.6,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.2,
      bevelThickness: 0.2
    };

    const wingPanelLeftGeo = new THREE.ExtrudeGeometry(panelShapeLeft, extrudePanel);
    wingPanelLeftGeo.center();
    wingPanelLeftGeo.rotateX(Math.PI / 2);

    const wingPanelRightGeo = new THREE.ExtrudeGeometry(panelShapeRight, extrudePanel);
    wingPanelRightGeo.center();
    wingPanelRightGeo.rotateX(Math.PI / 2);

    // Chin Nose Cannons (2x Nose Cannons per Artwork legend, chin mounted)
    const gunNoseMountGeo = new THREE.BoxGeometry(4.0, 1.2, 2.0);
    const gunNoseLeftGeo = new THREE.CylinderGeometry(0.3, 0.3, 5.0, 8);
    gunNoseLeftGeo.rotateZ(Math.PI / 2);
    const gunNoseRightGeo = new THREE.CylinderGeometry(0.3, 0.3, 5.0, 8);
    gunNoseRightGeo.rotateZ(Math.PI / 2);

    // --- 8. Merge Structural Geometries & Apply Colors ---
    // Carbon structural parts (High-Contrast Steel Blue: 0x485e7d)
    const bodyCloned = ensureNonIndexed(bodyGeo);
    bodyCloned.translate(1, 0, 0);
    addVertexColor(bodyCloned, 0x485e7d);

    const noseCloned = ensureNonIndexed(noseGeo);
    noseCloned.translate(-13, 0, 0);
    addVertexColor(noseCloned, 0x485e7d);

    const rearCloned = ensureNonIndexed(rearGeo);
    rearCloned.translate(12, 0, 0);
    addVertexColor(rearCloned, 0x485e7d);

    const engineLCloned = ensureNonIndexed(engineLeftGeo);
    engineLCloned.translate(6, 2.2, 2.8);
    addVertexColor(engineLCloned, 0x485e7d);

    const engineRCloned = ensureNonIndexed(engineRightGeo);
    engineRCloned.translate(6, 2.2, -2.8);
    addVertexColor(engineRCloned, 0x485e7d);

    const wingClonedParsed = ensureNonIndexed(wingCloned);
    addVertexColor(wingClonedParsed, 0x485e7d);

    const ridgeCloned = ensureNonIndexed(ridgeGeo);
    ridgeCloned.translate(3.0, 2.0, 0);
    addVertexColor(ridgeCloned, 0x485e7d);

    const shoulderLCloned = ensureNonIndexed(shoulderLGeo);
    shoulderLCloned.translate(-6.0, 0.2, 3.2);
    addVertexColor(shoulderLCloned, 0x2a3345); // Dark shoulder pod

    const shoulderRCloned = ensureNonIndexed(shoulderRGeo);
    shoulderRCloned.translate(-6.0, 0.2, -3.2);
    addVertexColor(shoulderRCloned, 0x2a3345);

    const finLBottomCloned = ensureNonIndexed(finLeftBottomGeo);
    finLBottomCloned.translate(10.0, 3.05, 2.8);
    addVertexColor(finLBottomCloned, 0x485e7d);

    const finRBottomCloned = ensureNonIndexed(finRightBottomGeo);
    finRBottomCloned.translate(10.0, 3.05, -2.8);
    addVertexColor(finRBottomCloned, 0x485e7d);

    const wingletLBotCloned = ensureNonIndexed(wingletLBottomGeo);
    wingletLBotCloned.translate(14.0, 0.8, 23.0);
    addVertexColor(wingletLBotCloned, 0x485e7d);

    const wingletRBotCloned = ensureNonIndexed(wingletRBottomGeo);
    wingletRBotCloned.translate(14.0, 0.8, -23.0);
    addVertexColor(wingletRBotCloned, 0x485e7d);

    const carbonGeos = [
      bodyCloned, noseCloned, rearCloned,
      engineLCloned, engineRCloned,
      wingClonedParsed, ridgeCloned,
      shoulderLCloned, shoulderRCloned,
      finLBottomCloned, finRBottomCloned,
      wingletLBotCloned, wingletRBotCloned
    ];

    // Crimson red accent parts (Vibrant electric crimson: 0xff2d55)
    const tipCloned = ensureNonIndexed(noseTipGeo);
    tipCloned.translate(-20.25, 0, 0);
    addVertexColor(tipCloned, 0xff2d55);

    const intakeLCloned = ensureNonIndexed(intakeLeftGeo);
    intakeLCloned.translate(0.0, 2.2, 2.8);
    addVertexColor(intakeLCloned, 0xff2d55);

    const intakeRCloned = ensureNonIndexed(intakeRightGeo);
    intakeRCloned.translate(0.0, 2.2, -2.8);
    addVertexColor(intakeRCloned, 0xff2d55);

    const endplateLCloned = ensureNonIndexed(endplateLeftGeo);
    endplateLCloned.translate(12.0, -0.4, 23.0);
    addVertexColor(endplateLCloned, 0xff2d55);

    const endplateRCloned = ensureNonIndexed(endplateRightGeo);
    endplateRCloned.translate(12.0, -0.4, -23.0);
    addVertexColor(endplateRCloned, 0xff2d55);

    const wingPanelLCloned = ensureNonIndexed(wingPanelLeftGeo);
    wingPanelLCloned.translate(2.5, 0.7, 9.5);
    addVertexColor(wingPanelLCloned, 0xff2d55);

    const wingPanelRCloned = ensureNonIndexed(wingPanelRightGeo);
    wingPanelRCloned.translate(2.5, 0.7, -9.5);
    addVertexColor(wingPanelRCloned, 0xff2d55);

    const finLTopCloned = ensureNonIndexed(finLeftTopGeo);
    finLTopCloned.translate(10.5, 4.95, 2.8);
    addVertexColor(finLTopCloned, 0xff2d55);

    const finRTopCloned = ensureNonIndexed(finRightTopGeo);
    finRTopCloned.translate(10.5, 4.95, -2.8);
    addVertexColor(finRTopCloned, 0xff2d55);

    const wingletLTopCloned = ensureNonIndexed(wingletLTopGeo);
    wingletLTopCloned.translate(14.5, 2.3, 23.0);
    addVertexColor(wingletLTopCloned, 0xff2d55);

    const wingletRTopCloned = ensureNonIndexed(wingletRTopGeo);
    wingletRTopCloned.translate(14.5, 2.3, -23.0);
    addVertexColor(wingletRTopCloned, 0xff2d55);

    const crimsonGeos = [
      tipCloned, intakeLCloned, intakeRCloned,
      endplateLCloned, endplateRCloned,
      wingPanelLCloned, wingPanelRCloned,
      finLTopCloned, finRTopCloned,
      wingletLTopCloned, wingletRTopCloned
    ];

    // Copper & Gunmetal steel parts (High-Contrast Cannons & Spliced Piping)
    const nozzleLCloned = ensureNonIndexed(nozzleLeftGeo);
    nozzleLCloned.translate(13.0, 2.2, 2.8);
    addVertexColor(nozzleLCloned, 0x6b778c);

    const nozzleRCloned = ensureNonIndexed(nozzleRightGeo);
    nozzleRCloned.translate(13.0, 2.2, -2.8);
    addVertexColor(nozzleRCloned, 0x6b778c);

    const hubLCloned = ensureNonIndexed(hubLeftGeo);
    hubLCloned.translate(-1.0, 2.2, 2.8);
    addVertexColor(hubLCloned, 0x6b778c);

    const hubRCloned = ensureNonIndexed(hubRightGeo);
    hubRCloned.translate(-1.0, 2.2, -2.8);
    addVertexColor(hubRCloned, 0x6b778c);

    const gunLOCloned = ensureNonIndexed(gunLeftOuterGeo);
    gunLOCloned.translate(10.5, -0.4, 22.2);
    addVertexColor(gunLOCloned, 0x6b778c);

    const gunLICloned = ensureNonIndexed(gunLeftInnerGeo);
    gunLICloned.translate(10.5, -0.4, 23.8);
    addVertexColor(gunLICloned, 0x6b778c);

    const gunROCloned = ensureNonIndexed(gunRightOuterGeo);
    gunROCloned.translate(10.5, -0.4, -22.2);
    addVertexColor(gunROCloned, 0x6b778c);

    const gunRICloned = ensureNonIndexed(gunRightInnerGeo);
    gunRICloned.translate(10.5, -0.4, -23.8);
    addVertexColor(gunRICloned, 0x6b778c);

    const gunNoseMountCloned = ensureNonIndexed(gunNoseMountGeo);
    gunNoseMountCloned.translate(-14.5, -1.2, 0.0);
    addVertexColor(gunNoseMountCloned, 0x6b778c);

    const gunNoseLCloned = ensureNonIndexed(gunNoseLeftGeo);
    gunNoseLCloned.translate(-16.5, -1.2, 0.8);
    addVertexColor(gunNoseLCloned, 0x6b778c);

    const gunNoseRCloned = ensureNonIndexed(gunNoseRightGeo);
    gunNoseRCloned.translate(-16.5, -1.2, -0.8);
    addVertexColor(gunNoseRCloned, 0x6b778c);

    // Spliced gold/copper top deck mechanical conduits
    const pipeLCloned = ensureNonIndexed(pipeLGeo);
    pipeLCloned.translate(4.0, 2.4, 1.2);
    addVertexColor(pipeLCloned, 0xd4af37);

    const pipeRCloned = ensureNonIndexed(pipeRGeo);
    pipeRCloned.translate(4.0, 2.4, -1.2);
    addVertexColor(pipeRCloned, 0xd4af37);

    const pipeOLCloned = ensureNonIndexed(pipeOuterLGeo);
    pipeOLCloned.translate(4.0, 2.2, 4.5);
    addVertexColor(pipeOLCloned, 0xd4af37);

    const pipeORCloned = ensureNonIndexed(pipeOuterRGeo);
    pipeORCloned.translate(4.0, 2.2, -4.5);
    addVertexColor(pipeORCloned, 0xd4af37);

    // Bright intake light plates
    const lightLCloned = ensureNonIndexed(lightLGeo);
    lightLCloned.translate(-4.5, 0.2, 5.0);
    addVertexColor(lightLCloned, 0xffaa00);

    const lightRCloned = ensureNonIndexed(lightRGeo);
    lightRCloned.translate(-4.5, 0.2, -5.0);
    addVertexColor(lightRCloned, 0xffaa00);

    const gunmetalGeos = [
      nozzleLCloned, nozzleRCloned,
      hubLCloned, hubRCloned,
      gunLOCloned, gunLICloned, gunROCloned, gunRICloned,
      gunNoseMountCloned, gunNoseLCloned, gunNoseRCloned,
      pipeLCloned, pipeRCloned, pipeOLCloned, pipeORCloned,
      lightLCloned, lightRCloned
    ];

    // Merge structural geometries into a single ship mesh
    const hullGeos = [
      ...carbonGeos,
      ...crimsonGeos,
      ...gunmetalGeos
    ];
    const mergedHullGeo = mergeGeometries(hullGeos);
    const shipMesh = new THREE.Mesh(mergedHullGeo, shipMat);
    visuals.add(shipMesh);

    // Clean up temporary structural geometries
    hullGeos.forEach(g => g.dispose());
    bodyGeo.dispose();
    noseGeo.dispose();
    rearGeo.dispose();
    noseTipGeo.dispose();
    ridgeGeo.dispose();
    shoulderLGeo.dispose();
    shoulderRGeo.dispose();
    lightLGeo.dispose();
    lightRGeo.dispose();
    finLeftBottomGeo.dispose();
    finLeftTopGeo.dispose();
    finRightBottomGeo.dispose();
    finRightTopGeo.dispose();
    pipeLGeo.dispose();
    pipeRGeo.dispose();
    pipeOuterLGeo.dispose();
    pipeOuterRGeo.dispose();
    engineLeftGeo.dispose();
    engineRightGeo.dispose();
    intakeLeftGeo.dispose();
    intakeRightGeo.dispose();
    hubLeftGeo.dispose();
    hubRightGeo.dispose();
    nozzleLeftGeo.dispose();
    nozzleRightGeo.dispose();
    wingLGeo.dispose();
    wingRGeo.dispose();
    wingLCloned.dispose();
    wingRCloned.dispose();
    endplateLeftGeo.dispose();
    endplateRightGeo.dispose();
    wingletLBottomGeo.dispose();
    wingletLTopGeo.dispose();
    wingletRBottomGeo.dispose();
    wingletRTopGeo.dispose();
    gunLeftOuterGeo.dispose();
    gunLeftInnerGeo.dispose();
    gunRightOuterGeo.dispose();
    gunRightInnerGeo.dispose();
    wingPanelLeftGeo.dispose();
    wingPanelRightGeo.dispose();
    gunNoseMountGeo.dispose();
    gunNoseLeftGeo.dispose();
    gunNoseRightGeo.dispose();

    // --- 9. Glowing independent visor warning sensor & Faceted Cockpit canopy ---
    // Faceted Cockpit canopy (repositioned to pop proud of flat fuselage deck)
    const canopyGeo = new THREE.CylinderGeometry(1.4, 1.8, 8, 6);
    canopyGeo.rotateZ(Math.PI / 2);
    const canopyCloned = ensureNonIndexed(canopyGeo);
    canopyCloned.scale(1.1, 0.8, 1.2);
    canopyCloned.translate(-5.0, 2.3, 0);
    const canopyMesh = new THREE.Mesh(canopyCloned, cockpitMat);
    visuals.add(canopyMesh);

    // Glowing red warning sensor strip (the visor)
    const sensorGeo = new THREE.BoxGeometry(2.0, 0.6, 2.5);
    const sensorCloned = ensureNonIndexed(sensorGeo);
    sensorCloned.rotateZ(0.1);
    sensorCloned.translate(-13.5, 1.3, 0);
    const visorMesh = new THREE.Mesh(sensorCloned, visorMat);
    visuals.add(visorMesh);

    // Clean up canopy & visor temporary geometries
    canopyGeo.dispose();
    canopyCloned.dispose();
    sensorGeo.dispose();
    sensorCloned.dispose();

    // --- 10. Merged engine flames (Twin orange-red exhaust cones with yellow inner cores) ---
    // Outer Flames
    const flameLeftGeo = new THREE.ConeGeometry(1.2, 10, 8);
    flameLeftGeo.rotateZ(-Math.PI / 2); // points backward (+X)
    const flameRightGeo = new THREE.ConeGeometry(1.2, 10, 8);
    flameRightGeo.rotateZ(-Math.PI / 2);

    const flameLCloned = ensureNonIndexed(flameLeftGeo);
    flameLCloned.translate(0.5, 2.2, 2.8);

    const flameRCloned = ensureNonIndexed(flameRightGeo);
    flameRCloned.translate(0.5, 2.2, -2.8);

    // Inner Hot Cores (Hot yellow-white supersonic flame center)
    const flameCoreMat = new THREE.MeshBasicMaterial({
      color: 0xffe600, // Vibrant hot yellow core flame
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const flameCoreLGeo = new THREE.ConeGeometry(0.6, 6, 8);
    flameCoreLGeo.rotateZ(-Math.PI / 2);
    const flameCoreRGeo = new THREE.ConeGeometry(0.6, 6, 8);
    flameCoreRGeo.rotateZ(-Math.PI / 2);

    const flameCoreLCloned = ensureNonIndexed(flameCoreLGeo);
    flameCoreLCloned.translate(2.5, 2.2, 2.8);

    const flameCoreRCloned = ensureNonIndexed(flameCoreRGeo);
    flameCoreRCloned.translate(2.5, 2.2, -2.8);

    // Merge outer flames
    const flameGeos = [flameLCloned, flameRCloned];
    const mergedFlameGeo = mergeGeometries(flameGeos);
    const flameMesh = new THREE.Mesh(mergedFlameGeo, flameMat);
    flameMesh.position.set(13.0, 0, 0); // Position at nozzle exits to scale perfectly
    visuals.add(flameMesh);
    this._mainFlame = flameMesh;

    // Merge inner cores and add directly as a child of the outer flame so it scales perfectly in unison!
    const coreGeos = [flameCoreLCloned, flameCoreRCloned];
    const mergedCoreGeo = mergeGeometries(coreGeos);
    const coreMesh = new THREE.Mesh(mergedCoreGeo, flameCoreMat);
    flameMesh.add(coreMesh); // Nest under outer flame!

    const leftGun = new THREE.Object3D();
    leftGun.position.set(10.5, -0.4, 23.0);
    visuals.add(leftGun);
    this._leftGunPoint = leftGun;

    const rightGun = new THREE.Object3D();
    rightGun.position.set(10.5, -0.4, -23.0);
    visuals.add(rightGun);
    this._rightGunPoint = rightGun;

    // Clean up flame temporary geometries
    flameGeos.forEach(g => g.dispose());
    coreGeos.forEach(g => g.dispose());
    flameLeftGeo.dispose();
    flameRightGeo.dispose();
    flameCoreLGeo.dispose();
    flameCoreRGeo.dispose();

    visuals.rotation.x = Math.PI / 2; // Rotate to face top-deck toward the gameplay camera
    visuals.scale.set(1.4, 1.4, 1.4); // Scale up slightly to preserve gameplay threat dimensions
    return group;
  }
}
