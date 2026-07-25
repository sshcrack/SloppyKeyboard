import * as THREE from 'three';

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 1.0);
}`;

const fragmentShader = `
precision highp float;
uniform sampler2D screenFrame;
uniform vec2 resolution;
uniform vec2 impact;
uniform float fracture;
varying vec2 vUv;

float hash(float n) { return fract(sin(n) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(dot(i, vec2(127.1,311.7))),
                 hash(dot(i + vec2(1,0), vec2(127.1,311.7))), f.x),
             mix(hash(dot(i + vec2(0,1), vec2(127.1,311.7))),
                 hash(dot(i + vec2(1), vec2(127.1,311.7))), f.x), f.y);
}
vec2 hash22(vec2 p) {
  return fract(18.5453 * sin(p * mat2(127.1,311.7,269.5,183.3)));
}
vec3 voronoiBorder(vec2 u) {
  vec2 iu = floor(u), nearestCell = vec2(0), nearestVector = vec2(0);
  float nearest = 1e9;
  for (int k = 0; k < 25; k++) {
    vec2 p = iu + vec2(float(k % 5 - 2), float(k / 5 - 2));
    vec2 offset = -.5 + 2.0 * hash22(p);
    vec2 r = p - u + offset;
    float d = dot(r, r);
    if (d < nearest) {
      nearest = d;
      nearestCell = p - iu;
      nearestVector = r;
    }
  }
  nearest = 1e9;
  for (int k = 0; k < 25; k++) {
    vec2 p = iu + nearestCell + vec2(float(k % 5 - 2), float(k / 5 - 2));
    vec2 r = p - u + (-.5 + 2.0 * hash22(p));
    if (dot(nearestVector-r, nearestVector-r) > 1e-5) {
      nearest = min(nearest, .5 * dot(nearestVector+r, normalize(r-nearestVector)));
    }
  }
  return vec3(nearest, nearestVector + u);
}
vec2 fbm22(vec2 p) {
  vec2 value = vec2(0);
  float amplitude = .5;
  mat2 turn = mat2(cos(.37),-sin(.37),sin(.37),cos(.37));
  for (int i = 0; i < 6; i++) {
    value += amplitude * vec2(noise(p), noise(p + 17.7));
    p = p * 2.0 * turn;
    amplitude *= .5;
  }
  return value;
}

void main() {
  vec2 aspect = vec2(resolution.x / resolution.y, 1.0);
  vec2 delta = (vUv - impact) * aspect;
  float radius = length(delta);
  float angle = atan(delta.y, delta.x);
  float rays = 29.0;
  float polar = (angle + 3.14159265) / 6.2831853 * rays;
  float radialWarp = (noise(vec2(angle * 3.1, radius * 17.0)) - .5) * .34;
  float sector = floor(polar + radialWarp);
  float rayEdge = abs(fract(polar + radialWarp) - .5) * 2.0;
  float rings = radius * (7.0 + hash(sector) * 5.0)
    + noise(vec2(angle * 5.0, radius * 25.0)) * .7;
  float ringCell = floor(rings);
  float ringEdge = abs(fract(rings) - .5) * 2.0;
  // Multi-scale warped Voronoi borders are adapted from the complete
  // project shader.glsl (Vorocracks variant); radial stress keeps them local.
  vec2 voronoiPoint = delta * 10.0 + fbm22(delta * 7.0) * .67;
  vec3 cell = voronoiBorder(voronoiPoint);
  float voronoiEdge = (1.0 - smoothstep(.008, .022, abs(cell.x)))
    * (1.0 - smoothstep(.08, .38, radius));
  float cellId = sector * 37.0 + ringCell * 71.0
    + floor(cell.y * 19.0) + floor(cell.z * 31.0);
  float reveal = 1.0 - smoothstep(fracture * 1.15 - .12, fracture * 1.15 + .08, radius);
  float stress = exp(-radius * 2.8);
  float edge = max(
    smoothstep(.965, .997, max(rayEdge, ringEdge)) * stress,
    voronoiEdge
  );
  float filament = smoothstep(.982, .999, rayEdge) * stress;

  vec2 shardShift = vec2(hash(cellId) - .5, hash(cellId + 19.0) - .5);
  shardShift *= fracture * reveal * (.002 + .012 * stress);
  shardShift += normalize(delta + vec2(.0001)) * fracture * reveal
    * (hash(cellId + 9.0) - .5) * .006;
  vec2 uv = clamp(vUv + shardShift, vec2(0.001), vec2(.999));
  float split = fracture * reveal * edge * (.0015 + stress * .0025);
  vec3 color;
  color.r = texture2D(screenFrame, clamp(uv + vec2(split, 0), 0.0, 1.0)).r;
  color.g = texture2D(screenFrame, uv).g;
  color.b = texture2D(screenFrame, clamp(uv - vec2(split, 0), 0.0, 1.0)).b;

  float glassHighlight = (filament * .92 + edge * .38) * reveal * fracture;
  float bevelShadow = smoothstep(.935, .968, max(rayEdge, ringEdge))
    * (1.0 - edge) * stress * reveal * fracture * .16;
  color = color * (1.0 - bevelShadow) + vec3(.82, .92, 1.0) * glassHighlight;
  float crater = (1.0 - smoothstep(.0, .035, radius)) * fracture;
  color = mix(color, vec3(.92, .97, 1.0), crater * .85);
  gl_FragColor = vec4(color, fracture > .001 ? 1.0 : fracture);
}`;

export const runGlassFracture = (
  host: HTMLElement,
  snapshot: string,
  hitX: number,
  hitY: number,
): void => {
  const width = host.clientWidth;
  const height = host.clientHeight;
  const canvas = document.createElement('canvas');
  canvas.className = 'glass-shader';
  host.prepend(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(width, height);
  const frameTexture = new THREE.TextureLoader().load(snapshot);
  frameTexture.colorSpace = THREE.SRGBColorSpace;
  frameTexture.minFilter = THREE.LinearFilter;
  const uniforms = {
    screenFrame: { value: frameTexture },
    resolution: { value: new THREE.Vector2(width, height) },
    impact: { value: new THREE.Vector2(hitX / width, 1 - hitY / height) },
    fracture: { value: 0 },
  };
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  scene.add(new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      uniforms, vertexShader, fragmentShader, transparent: true,
    }),
  ));
  const started = performance.now();
  const render = (now: number): void => {
    const elapsed = (now - started) / 1000;
    let amount = 0;
    if (elapsed >= 1.48 && elapsed < 2.15) amount = (elapsed - 1.48) / .67;
    else if (elapsed >= 2.15 && elapsed < 6.6) amount = 1;
    else if (elapsed >= 6.6 && elapsed < 8.15) amount = 1 - (elapsed - 6.6) / 1.55;
    uniforms.fracture.value = THREE.MathUtils.smootherstep(amount, 0, 1);
    renderer.render(scene, camera);
    if (elapsed < 8.2) requestAnimationFrame(render);
    else {
      frameTexture.dispose();
      renderer.dispose();
      canvas.remove();
    }
  };
  requestAnimationFrame(render);
};
