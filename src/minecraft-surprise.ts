import * as THREE from 'three';
import { createMinecraftScenePlan, type VoxelCell } from './minecraft-scene-plan';

// All textures and sounds below are extracted from the user's locally installed
// Minecraft jar. They are bundled locally; the surprise has no runtime web dependency.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const steveUrl = require('../assets/minecraft/steve.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const grassTopUrl = require('../assets/minecraft/grass_block_top.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const grassSideUrl = require('../assets/minecraft/grass_block_side.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const stoneUrl = require('../assets/minecraft/stone.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const torchUrl = require('../assets/minecraft/torch.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pickaxeUrl = require('../assets/minecraft/iron_pickaxe.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const stoneSoundUrl = require('../assets/minecraft/4ec831592ae2bcbac1b4047a9f9f72a2de5ca834.ogg') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const placeSoundUrl = require('../assets/minecraft/ef59a7ee4163d8b06fcda67e356ffe717756adda.ogg') as string;

const destroyUrls = Array.from({ length: 10 }, (_, index) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(`../assets/minecraft/destroy_stage_${index}.png`) as string;
});

const texture = (url: string): THREE.Texture => {
  const result = new THREE.TextureLoader().load(url);
  result.magFilter = THREE.NearestFilter;
  result.minFilter = THREE.NearestFilter;
  result.colorSpace = THREE.SRGBColorSpace;
  return result;
};

type SkinRect = readonly [number, number, number, number];
const skinMaterial = (source: THREE.Texture, [x, y, width, height]: SkinRect): THREE.Material => {
  const map = source.clone();
  map.repeat.set(width / 64, height / 64);
  map.offset.set(x / 64, 1 - (y + height) / 64);
  map.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ map, transparent: true });
};

const cuboid = (
  size: readonly [number, number, number],
  skin: THREE.Texture,
  faces: readonly SkinRect[],
): THREE.Mesh => new THREE.Mesh(
  new THREE.BoxGeometry(...size),
  faces.map((face) => skinMaterial(skin, face)),
);

const createSteve = (): {
  group: THREE.Group;
  rightArm: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftLeg: THREE.Mesh;
  pickaxe: THREE.Sprite;
} => {
  const skin = texture(steveUrl);
  const group = new THREE.Group();
  const head = cuboid([1, 1, 1], skin, [
    [0, 8, 8, 8], [16, 8, 8, 8], [8, 0, 8, 8],
    [16, 0, 8, 8], [8, 8, 8, 8], [24, 8, 8, 8],
  ]);
  const body = cuboid([1, 1.5, .5], skin, [
    [16, 20, 4, 12], [28, 20, 4, 12], [20, 16, 8, 4],
    [28, 16, 8, 4], [20, 20, 8, 12], [32, 20, 8, 12],
  ]);
  const rightArm = cuboid([.5, 1.5, .5], skin, [
    [40, 20, 4, 12], [48, 20, 4, 12], [44, 16, 4, 4],
    [48, 16, 4, 4], [44, 20, 4, 12], [52, 20, 4, 12],
  ]);
  const leftArm = cuboid([.5, 1.5, .5], skin, [
    [32, 52, 4, 12], [40, 52, 4, 12], [36, 48, 4, 4],
    [40, 48, 4, 4], [36, 52, 4, 12], [44, 52, 4, 12],
  ]);
  const rightLeg = cuboid([.5, 1.5, .5], skin, [
    [0, 20, 4, 12], [8, 20, 4, 12], [4, 16, 4, 4],
    [8, 16, 4, 4], [4, 20, 4, 12], [12, 20, 4, 12],
  ]);
  const leftLeg = cuboid([.5, 1.5, .5], skin, [
    [16, 52, 4, 12], [24, 52, 4, 12], [20, 48, 4, 4],
    [24, 48, 4, 4], [20, 52, 4, 12], [28, 52, 4, 12],
  ]);
  head.position.y = 2.55;
  body.position.y = 1.3;
  rightArm.position.set(-.78, 1.85, 0);
  leftArm.position.set(.78, 1.85, 0);
  rightLeg.position.set(-.27, .35, 0);
  leftLeg.position.set(.27, .35, 0);
  for (const limb of [rightArm, leftArm, rightLeg, leftLeg]) limb.geometry.translate(0, -.55, 0);
  const pickaxe = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture(pickaxeUrl), transparent: true, depthTest: true,
  }));
  pickaxe.scale.set(1.7, 1.7, 1);
  pickaxe.position.set(-.42, -.9, .1);
  rightArm.add(pickaxe);
  group.add(head, body, rightArm, leftArm, rightLeg, leftLeg);
  group.scale.setScalar(.72);
  return { group, rightArm, leftArm, rightLeg, leftLeg, pickaxe };
};

const playQuiet = (url: string, volume = .14): void => {
  const audio = new Audio(url);
  audio.volume = Math.min(.18, volume);
  void audio.play().catch((): void => undefined);
};

const makeBlock = (
  side: THREE.Texture,
  top = side,
  topTint?: number,
): THREE.Mesh => {
  const sideMaterial = (): THREE.Material => new THREE.MeshLambertMaterial({ map: side });
  return new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [
    sideMaterial(), sideMaterial(),
    new THREE.MeshLambertMaterial({ map: top, color: topTint ?? 0xffffff }),
    new THREE.MeshLambertMaterial({ map: side }),
    sideMaterial(), sideMaterial(),
  ]);
};

const makeCaveBlock = (stone: THREE.Texture, showFront: boolean): THREE.Mesh => {
  const block = makeBlock(stone);
  const materials = block.material as THREE.Material[];
  // The desktop is the cave's front plane. Only the first recessed voxel
  // layer has a front face; deeper layers expose their inner side geometry.
  materials[4].visible = showFront;
  for (const material of materials) {
    material.stencilWrite = true;
    material.stencilRef = 1;
    material.stencilFunc = THREE.EqualStencilFunc;
    material.stencilFail = THREE.KeepStencilOp;
    material.stencilZFail = THREE.KeepStencilOp;
    material.stencilZPass = THREE.KeepStencilOp;
  }
  return block;
};

const stencilObject = (object: THREE.Object3D): void => {
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh) && !(child instanceof THREE.Sprite)) return;
    const source = child.material as THREE.Material | THREE.Material[];
    for (const material of Array.isArray(source) ? source : [source]) {
      material.stencilWrite = true;
      material.stencilRef = 1;
      material.stencilFunc = THREE.EqualStencilFunc;
      material.stencilFail = THREE.KeepStencilOp;
      material.stencilZFail = THREE.KeepStencilOp;
      material.stencilZPass = THREE.KeepStencilOp;
    }
  });
};

const at = (cell: VoxelCell, mesh: THREE.Object3D): THREE.Object3D => {
  mesh.position.set(cell.x, cell.y + .5, cell.z);
  return mesh;
};

export const runMinecraftDig = (
  host: HTMLElement,
  impactX: number,
  taskbarTop: number,
): void => {
  const width = host.clientWidth;
  const height = host.clientHeight;
  const canvas = document.createElement('canvas');
  canvas.className = 'minecraft-3d';
  host.append(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas, alpha: true, antialias: false, stencil: true,
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, width / height, .1, 100);
  camera.position.set(0, 5.1, 14);
  camera.lookAt(0, 1.5, -2.2);
  scene.add(new THREE.HemisphereLight(0xb8d5ff, 0x17130c, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 3.2);
  sun.position.set(-5, 9, 8);
  scene.add(sun);

  const grassTop = texture(grassTopUrl);
  const grassSide = texture(grassSideUrl);
  const stone = texture(stoneUrl);
  const damage = destroyUrls.map(texture);
  const targetColumn = Math.round(THREE.MathUtils.lerp(-1, 3, impactX / Math.max(width, 1)));
  const plan = createMinecraftScenePlan({ targetColumn, leftColumn: -8 });
  const root = new THREE.Group();
  scene.add(root);

  // Anchor the top of the grass blocks to the real taskbar edge. The binary
  // projection solve keeps this correct for different resolutions/aspects.
  const targetScreenY = THREE.MathUtils.clamp(taskbarTop, height * .64, height - 8);
  let low = -8;
  let high = 5;
  for (let index = 0; index < 28; index += 1) {
    const candidate = (low + high) / 2;
    const projected = new THREE.Vector3(0, candidate + 1, 0).project(camera);
    const screenY = (1 - projected.y) * height / 2;
    if (screenY > targetScreenY) low = candidate;
    else high = candidate;
  }
  root.position.y = (low + high) / 2;

  const walkway = plan.walkway.map((cell) => {
    const block = at(cell, makeBlock(grassSide, grassTop, 0x79c24a)) as THREE.Mesh;
    block.visible = false;
    root.add(block);
    return block;
  });

  const caveGroup = new THREE.Group();
  caveGroup.visible = false;
  root.add(caveGroup);
  for (const cell of plan.cave) {
    caveGroup.add(at(cell, makeCaveBlock(stone, cell.z === -1)));
  }
  const darkness = new THREE.Mesh(
    new THREE.PlaneGeometry(.97, 1.97),
    new THREE.MeshBasicMaterial({
      color: 0x050403,
      stencilWrite: true,
      stencilRef: 1,
      stencilFunc: THREE.EqualStencilFunc,
      stencilFail: THREE.KeepStencilOp,
      stencilZFail: THREE.KeepStencilOp,
      stencilZPass: THREE.KeepStencilOp,
    }),
  );
  darkness.position.set(targetColumn, 2, -5.55);
  caveGroup.add(darkness);

  const apertures = plan.opening.map((cell) => {
    const aperture = new THREE.Mesh(
      new THREE.PlaneGeometry(.985, .985),
      new THREE.MeshBasicMaterial({ color: 0x050403 }),
    );
    aperture.position.set(cell.x, cell.y + .5, .05);
    aperture.visible = false;
    root.add(aperture);
    return aperture;
  });
  const damagePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(.985, .985),
    new THREE.ShaderMaterial({
      uniforms: { damageMap: { value: damage[0] } },
      vertexShader: 'varying vec2 damageUv;void main(){damageUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: 'uniform sampler2D damageMap;varying vec2 damageUv;void main(){vec3 c=texture2D(damageMap,damageUv).rgb;float ink=1.-dot(c,vec3(.299,.587,.114));gl_FragColor=vec4(vec3(.04),smoothstep(.025,.38,ink));}',
      transparent: true,
      depthTest: false,
    }),
  );
  damagePlane.visible = false;
  damagePlane.renderOrder = 20;
  root.add(damagePlane);

  const torch = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture(torchUrl), transparent: true,
  }));
  torch.scale.set(.45, 1.05, 1);
  torch.position.set(targetColumn + .38, 1.65, -3.8);
  caveGroup.add(torch);
  const torchLight = new THREE.PointLight(0xff9b38, 4, 7);
  torchLight.position.copy(torch.position);
  caveGroup.add(torchLight);
  stencilObject(torch);

  const portalMasks = plan.opening.map((cell) => {
    const mask = new THREE.Mesh(
      new THREE.PlaneGeometry(.99, .99),
      new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
        stencilWrite: true,
        stencilRef: 1,
        stencilFunc: THREE.AlwaysStencilFunc,
        stencilFail: THREE.KeepStencilOp,
        stencilZFail: THREE.ReplaceStencilOp,
        stencilZPass: THREE.ReplaceStencilOp,
      }),
    );
    mask.position.set(cell.x, cell.y + .5, .08);
    mask.renderOrder = -10;
    mask.visible = false;
    root.add(mask);
    return mask;
  });

  const steve = createSteve();
  steve.group.position.set(-8, 1.02, .58);
  root.add(steve.group);

  const particles: THREE.Mesh[] = [];
  for (let index = 0; index < 24; index += 1) {
    const particle = new THREE.Mesh(
      new THREE.BoxGeometry(.12, .12, .12),
      new THREE.MeshLambertMaterial({ map: stone }),
    );
    particle.visible = false;
    root.add(particle);
    particles.push(particle);
  }

  let placedCount = 0;
  let soundAt = 0;
  let lastDamageStage = -1;
  let activeDoor = -1;
  const started = performance.now();
  const frame = (now: number): void => {
    const elapsed = (now - started) / 1000;

    // 0–3.7s: grass blocks place in strict left-to-right order.
    const requestedPlaced = Math.min(
      walkway.length,
      Math.floor(elapsed / (3.7 / walkway.length)) + 1,
    );
    while (placedCount < requestedPlaced) {
      walkway[placedCount].visible = true;
      playQuiet(placeSoundUrl, .09);
      placedCount += 1;
    }
    // 3.8–7.0s: Steve walks on the completed grass bridge.
    if (elapsed < 3.8) steve.group.visible = false;
    else if (elapsed < 7) {
      steve.group.visible = true;
      const progress = (elapsed - 3.8) / 3.2;
      steve.group.position.x = THREE.MathUtils.lerp(-8, targetColumn - 1.15, progress);
      const stride = Math.sin(progress * Math.PI * 12);
      steve.group.position.y = 1.02 + Math.abs(stride) * .045;
      steve.rightArm.rotation.x = -stride * .7;
      steve.leftArm.rotation.x = stride * .7;
      steve.rightLeg.rotation.x = stride * .65;
      steve.leftLeg.rotation.x = -stride * .65;
      steve.group.rotation.y = Math.PI / 2;
      steve.pickaxe.visible = false;
    }

    // 7.0–10.2s: mine exactly the upper and lower doorway blocks.
    if (elapsed >= 7 && elapsed < 10.2) {
      const mining = elapsed - 7;
      activeDoor = Math.min(1, Math.floor(mining / 1.6));
      const doorIndex = activeDoor === 0 ? 1 : 0;
      const withinBlock = mining - activeDoor * 1.6;
      const stage = Math.min(9, Math.floor(withinBlock / .16));
      damagePlane.visible = true;
      damagePlane.position.set(
        targetColumn,
        plan.opening[doorIndex].y + .5,
        .515,
      );
      if (stage !== lastDamageStage) {
        (damagePlane.material as THREE.ShaderMaterial).uniforms.damageMap.value = damage[stage];
        lastDamageStage = stage;
      }
      steve.pickaxe.visible = true;
      steve.group.position.x = targetColumn - 1.08;
      steve.group.rotation.y = Math.PI / 2;
      steve.rightArm.rotation.x = -1.35 + Math.sin(mining * 18) * .9;
      if (now >= soundAt) {
        playQuiet(stoneSoundUrl, .16);
        soundAt = now + 320;
      }
      if (activeDoor === 1) apertures[1].visible = true;
    }
    if (elapsed >= 10.2) {
      damagePlane.visible = false;
      apertures[0].visible = false;
      apertures[1].visible = false;
      for (const mask of portalMasks) mask.visible = true;
      caveGroup.visible = true;
      steve.pickaxe.visible = false;
      stencilObject(steve.group);
    }

    // 10.2–12.0s: walk into actual Z depth. There is no scale or rotation
    // trick; perspective and the tunnel walls naturally occlude Steve.
    if (elapsed >= 10.2 && elapsed < 12) {
      const enter = (elapsed - 10.2) / 1.8;
      steve.group.rotation.y = Math.PI;
      steve.group.position.x = targetColumn;
      steve.group.position.z = THREE.MathUtils.lerp(.58, -4.5, enter);
      const stride = Math.sin(enter * Math.PI * 8);
      steve.rightLeg.rotation.x = stride * .6;
      steve.leftLeg.rotation.x = -stride * .6;
    }
    if (elapsed >= 12) steve.group.visible = false;

    // Place the two blocks behind him, top then bottom, closing the 1x2 hole.
    if (elapsed >= 12.05 && portalMasks[1].visible) {
      portalMasks[1].visible = false;
      playQuiet(placeSoundUrl);
    }
    if (elapsed >= 12.55 && portalMasks[0].visible) {
      portalMasks[0].visible = false;
      caveGroup.visible = false;
      playQuiet(placeSoundUrl);
    }

    renderer.render(scene, camera);
    if (elapsed < 13.5) requestAnimationFrame(frame);
    else {
      renderer.dispose();
      canvas.remove();
    }
  };
  requestAnimationFrame(frame);
};
