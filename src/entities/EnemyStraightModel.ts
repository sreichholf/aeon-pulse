import * as THREE from 'three';
import type { StandardEnemyModelBucketConfig } from '../systems/StandardEnemyModel.ts';

export const STRAIGHT_TARGET_MODEL_HEIGHT = 8.6;

export const STRAIGHT_MODEL_ROTATION = new THREE.Euler(0, 0, 0);

export const STRAIGHT_MODEL_OFFSET = new THREE.Vector3(-3, 1.3, 0);

export const STRAIGHT_MODEL_SOURCE_CENTER = new THREE.Vector3(-3, 1.3, 0);

export const STRAIGHT_VISUAL_ROTATION_X = Math.PI / 2;

export const STRAIGHT_VISUAL_SCALE = 1.4;

export const STRAIGHT_MODEL_BUCKET_CONFIG: StandardEnemyModelBucketConfig = {
  materialRules: {
    StraightBlue: { bucket: 'body', color: 0x485e7d },
    StraightDarkBlue: { bucket: 'body', color: 0x2a3345 },
    StraightCrimson: { bucket: 'body', color: 0xff2d55 },
    StraightGunmetal: { bucket: 'body', color: 0x6b778c },
    StraightCopper: { bucket: 'body', color: 0xd4af37 },
    StraightAmberGlow: { bucket: 'body', color: 0xffaa00 },
    StraightSensorGlow: { bucket: 'body', color: 0xff1a2c },
    StraightCanopyGlass: { bucket: 'glass', color: 0x00d2ff },
  },
  bodyMaterial: {
    roughness: 0.42,
    metalness: 0.52,
    emissive: 0x0d111a,
    emissiveIntensity: 1,
    flatShading: true,
    envMapIntensity: 1.1,
  },
  configureBodyMaterial: applyStraightDecalShader,
  glassMaterial: new THREE.MeshPhongMaterial({
    color: 0x00d2ff,
    emissive: 0x002b4d,
    shininess: 120,
    specular: 0xdff9fb,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  }),
};

export function applyStraightDecalShader(material: THREE.MeshStandardMaterial): void {
  const visorEmissiveUniform = { value: new THREE.Color(0.36, 0.032, 0.032) };
  material.userData['straightVisorEmissiveUniform'] = visorEmissiveUniform;
  material.customProgramCacheKey = () => 'EnemyStraightDecalsV3';
  material.onBeforeCompile = (shader) => {
    shader.uniforms['uStraightVisorEmissive'] = visorEmissiveUniform;
    shader.vertexShader = 'varying vec3 vStraightLocalPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vStraightLocalPosition = position.xyz + vec3(${STRAIGHT_MODEL_SOURCE_CENTER.x.toFixed(1)}, ${STRAIGHT_MODEL_SOURCE_CENTER.y.toFixed(1)}, ${STRAIGHT_MODEL_SOURCE_CENTER.z.toFixed(1)});`
    );

    shader.fragmentShader = `uniform vec3 uStraightVisorEmissive;
    varying vec3 vStraightLocalPosition;

    float getStraightLine(float val, float target, float thickness) {
      return smoothstep(thickness, thickness * 0.4, abs(val - target));
    }

    float drawStraightZero(vec2 uv) {
      float outer = step(abs(uv.x), 0.5) * step(abs(uv.y), 0.7);
      float inner = step(abs(uv.x), 0.25) * step(abs(uv.y), 0.45);
      float split = step(abs(uv.y), 0.1);
      return max(0.0, outer - inner - split);
    }

    float drawStraightSeven(vec2 uv) {
      float top = step(abs(uv.y - 0.55), 0.15) * step(abs(uv.x), 0.5);
      float diag = step(abs(uv.x + uv.y * 0.6 - 0.1), 0.15) * step(abs(uv.y), 0.7);
      return max(0.0, max(top, diag));
    }\n` + shader.fragmentShader;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>

      float straightPanelLine = 0.0;
      straightPanelLine = max(straightPanelLine, getStraightLine(vStraightLocalPosition.x, -6.0, 0.4));
      straightPanelLine = max(straightPanelLine, getStraightLine(vStraightLocalPosition.x, 1.0, 0.4));
      straightPanelLine = max(straightPanelLine, getStraightLine(vStraightLocalPosition.x, 6.0, 0.4));
      straightPanelLine = max(straightPanelLine, getStraightLine(vStraightLocalPosition.x, 12.0, 0.4));
      straightPanelLine = max(straightPanelLine, getStraightLine(abs(vStraightLocalPosition.z), 2.8, 0.4));
      straightPanelLine = max(straightPanelLine, getStraightLine(abs(vStraightLocalPosition.z), 5.0, 0.4));
      straightPanelLine = max(straightPanelLine, getStraightLine(abs(vStraightLocalPosition.z), 11.5, 0.4));
      straightPanelLine = max(straightPanelLine, getStraightLine(abs(vStraightLocalPosition.z), 22.2, 0.4));

      float straightIsWing = step(3.0, abs(vStraightLocalPosition.z));
      float straightSwept1 = abs(vStraightLocalPosition.x - (2.5 + abs(vStraightLocalPosition.z) * 0.5));
      straightPanelLine = max(straightPanelLine, smoothstep(0.4, 0.1, straightSwept1) * straightIsWing);
      float straightSwept2 = abs(vStraightLocalPosition.x - (-3.0 + abs(vStraightLocalPosition.z) * 0.6));
      straightPanelLine = max(straightPanelLine, smoothstep(0.4, 0.1, straightSwept2) * straightIsWing);

      vec3 straightPanelColor = diffuseColor.rgb * 0.35;
      diffuseColor.rgb = mix(diffuseColor.rgb, straightPanelColor, straightPanelLine * 0.9);

      float straightRivetVal = 0.0;
      float straightIsLongSeam = step(abs(abs(vStraightLocalPosition.z) - 2.8), 0.5);
      float straightDistX = abs(fract(vStraightLocalPosition.x / 2.0 + 0.5) - 0.5) * 2.0;
      straightRivetVal = max(straightRivetVal, smoothstep(0.35, 0.1, straightDistX) * straightIsLongSeam);
      float straightIsWingSeam = step(abs(abs(vStraightLocalPosition.z) - 11.5), 0.5);
      float straightDistWingX = abs(fract(vStraightLocalPosition.x / 2.5 + 0.5) - 0.5) * 2.5;
      straightRivetVal = max(straightRivetVal, smoothstep(0.35, 0.1, straightDistWingX) * straightIsWingSeam);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.05, 0.08, 0.1), straightRivetVal * 0.95);

      float straightDecalBird = 0.0;
      float straightInWingX = step(-3.0, vStraightLocalPosition.x) * step(vStraightLocalPosition.x, 8.0);
      float straightInWingZ = step(5.5, abs(vStraightLocalPosition.z)) * step(abs(vStraightLocalPosition.z), 17.5);
      vec2 straightPDecal = vec2(vStraightLocalPosition.x - 2.5, abs(vStraightLocalPosition.z) - 11.5) * 0.3;
      straightPDecal.x *= 1.2;
      float straightBodyDist = abs(straightPDecal.x) + abs(straightPDecal.y) * 2.0;
      float straightBody = smoothstep(0.6, 0.4, straightBodyDist);
      float straightWingDist = abs(straightPDecal.y - (straightPDecal.x - 0.4) * 0.7);
      float straightWingLimit = step(straightPDecal.x, 1.8) * step(-1.2, straightPDecal.x);
      float straightWings = smoothstep(0.5, 0.3, straightWingDist) * straightWingLimit;
      straightDecalBird = max(straightBody, straightWings) * straightInWingX * straightInWingZ;

      #ifdef USE_COLOR
      if (vColor.r < 0.8) {
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.98), straightDecalBird * 0.9);
      }
      #else
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.95, 0.98), straightDecalBird * 0.9);
      #endif

      float straightStencil = 0.0;
      float straightInEngineX = step(0.0, vStraightLocalPosition.x) * step(vStraightLocalPosition.x, 10.0);
      float straightInEngineZ = step(1.5, abs(vStraightLocalPosition.z)) * step(abs(vStraightLocalPosition.z), 4.5);
      vec2 straightUvDecal = vec2(vStraightLocalPosition.x - 5.0, abs(vStraightLocalPosition.z) - 2.8);
      vec2 straightP0 = (straightUvDecal - vec2(-1.2, 0.0)) * 1.5;
      vec2 straightP7 = (straightUvDecal - vec2(1.2, 0.0)) * 1.5;
      straightStencil = (drawStraightZero(straightP0) + drawStraightSeven(straightP7)) * straightInEngineX * straightInEngineZ;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.92, 0.55), straightStencil * 0.95);`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      'vec3 totalEmissiveRadiance = emissive;',
      `vec3 totalEmissiveRadiance = emissive;

      #ifdef USE_COLOR
      float straightVisorMask = step(0.9, vColor.r) * step(vColor.g, 0.18) * step(vColor.b, 0.25);
      straightVisorMask *= step(-15.0, vStraightLocalPosition.x) * step(vStraightLocalPosition.x, -12.0);
      totalEmissiveRadiance += uStraightVisorEmissive * straightVisorMask;

      float straightAmberGlowMask = step(0.9, vColor.r) * step(0.45, vColor.g) * step(vColor.g, 0.78) * step(vColor.b, 0.12);
      totalEmissiveRadiance += vec3(1.0, 0.42, 0.0) * straightAmberGlowMask * 0.9;
      #endif`
    );
  };
}
