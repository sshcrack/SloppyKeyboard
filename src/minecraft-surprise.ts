import * as THREE from 'three';

// webpack copies these genuine locally-installed Minecraft assets into the app.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const steveUrl = require('../assets/minecraft/steve.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const dirtUrl = require('../assets/minecraft/dirt.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const grassUrl = require('../assets/minecraft/grass_block_top.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const stoneUrl = require('../assets/minecraft/stone.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const torchUrl = require('../assets/minecraft/torch.png') as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const stoneSoundUrl = require(
  '../assets/minecraft/4ec831592ae2bcbac1b4047a9f9f72a2de5ca834.ogg',
) as string;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const woodSoundUrl = require(
  '../assets/minecraft/ef59a7ee4163d8b06fcda67e356ffe717756adda.ogg',
) as string;

const destroyUrls = Array.from({ length: 10 }, (_, index) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require(`../assets/minecraft/destroy_stage_${index}.png`) as string;
});

const loadPixelTexture = (url: string): THREE.Texture => {
  const texture = new THREE.TextureLoader().load(url);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

type SkinRect = readonly [number, number, number, number];

const cropMaterial = (
  source: THREE.Texture,
  [x, y, width, height]: SkinRect,
): THREE.MeshLambertMaterial => {
  const texture = source.clone();
  texture.repeat.set(width / 64, height / 64);
  texture.offset.set(x / 64, 1 - (y + height) / 64);
  texture.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ map: texture, transparent: true });
};

const cuboid = (
  size: readonly [number, number, number],
  texture: THREE.Texture,
  faces: readonly SkinRect[],
): THREE.Mesh => new THREE.Mesh(
  new THREE.BoxGeometry(...size),
  faces.map((face) => cropMaterial(texture, face)),
);

const createSteve = (): {
  group: THREE.Group;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
} => {
  const skin = loadPixelTexture(steveUrl);
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
  rightArm.position.set(-.78, 1.3, 0);
  leftArm.position.set(.78, 1.3, 0);
  rightLeg.position.set(-.27, -.2, 0);
  leftLeg.position.set(.27, -.2, 0);
  for (const limb of [rightArm, leftArm, rightLeg, leftLeg]) {
    limb.geometry.translate(0, -.55, 0);
    limb.position.y += .55;
  }
  group.add(head, body, rightArm, leftArm, rightLeg, leftLeg);
  group.scale.setScalar(.82);
  return { group, leftArm, rightArm, leftLeg, rightLeg };
};

const playQuiet = (url: string, volume: number): void => {
  const audio = new Audio(url);
  audio.volume = Math.min(.18, volume);
  void audio.play().catch((): void => undefined);
};

const texturedBlock = (
  sideTexture: THREE.Texture,
  topTexture = sideTexture,
): THREE.Mesh => new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  [
    sideTexture, sideTexture, topTexture,
    sideTexture, sideTexture, sideTexture,
  ].map((map) => new THREE.MeshLambertMaterial({ map })),
);

export const runMinecraftDig = (
  host: HTMLElement,
  impactX: number,
  impactY: number,
): void => {
  const width = host.clientWidth;
  const height = host.clientHeight;
  const canvas = document.createElement('canvas');
  canvas.className = 'minecraft-3d';
  host.append(canvas);

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(31, width / height, .1, 100);
  camera.position.set(0, 3.5, 13);
  camera.lookAt(0, 1, 0);
  scene.add(new THREE.HemisphereLight(0xd8edff, 0x202018, 2.5));
  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(-4, 8, 7);
  key.castShadow = true;
  scene.add(key);

  const dirt = loadPixelTexture(dirtUrl);
  const grass = loadPixelTexture(grassUrl);
  const stone = loadPixelTexture(stoneUrl);
  const destroy = destroyUrls.map(loadPixelTexture);
  const steve = createSteve();
  scene.add(steve.group);

  const normalizedX = (impactX / width - .5) * 9;
  const normalizedY = -(impactY / height - .72) * 4;
  const targetX = THREE.MathUtils.clamp(normalizedX, -2.5, 2.5);
  const floorY = THREE.MathUtils.clamp(normalizedY, -.2, 1.2);
  const startX = targetX > 0 ? targetX - 5.3 : targetX + 5.3;
  const direction = Math.sign(targetX - startX);
  steve.group.position.set(startX, floorY + 1.15, .2);
  steve.group.rotation.y = direction > 0 ? .42 : -.42;

  const placed: THREE.Object3D[] = [];
  const blockOne = texturedBlock(dirt, grass);
  const blockTwo = texturedBlock(dirt, grass);
  blockOne.position.set(targetX - direction * 2.6, floorY - .18, -.3);
  blockTwo.position.set(targetX - direction * 1.65, floorY + .16, -.2);
  for (const block of [blockOne, blockTwo]) {
    block.visible = false;
    block.castShadow = true;
    block.receiveShadow = true;
    scene.add(block);
    placed.push(block);
  }

  const torchTexture = loadPixelTexture(torchUrl);
  const torchMaterial = new THREE.SpriteMaterial({ map: torchTexture, transparent: true });
  const torch = new THREE.Sprite(torchMaterial);
  torch.scale.set(.42, 1.05, 1);
  torch.position.set(targetX + direction * 1.28, floorY + .52, .1);
  torch.visible = false;
  scene.add(torch);
  placed.push(torch);

  const hole = new THREE.Group();
  hole.position.set(targetX, floorY - .2, -.15);
  const voidPlane = new THREE.Mesh(
    new THREE.CircleGeometry(1.05, 4),
    new THREE.MeshBasicMaterial({ color: 0x020205, transparent: true, opacity: .95 }),
  );
  voidPlane.rotation.z = Math.PI / 4;
  hole.add(voidPlane);
  for (let index = 0; index < 8; index += 1) {
    const angle = index / 8 * Math.PI * 2;
    const block = texturedBlock(stone);
    block.scale.setScalar(.65);
    block.position.set(Math.cos(angle) * 1.05, Math.sin(angle) * .65, -.1);
    block.rotation.z = angle;
    hole.add(block);
  }
  hole.visible = false;
  scene.add(hole);

  const damagePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    new THREE.MeshBasicMaterial({ map: destroy[0], transparent: true, depthTest: false }),
  );
  damagePlane.position.set(targetX, floorY + .05, .8);
  damagePlane.visible = false;
  scene.add(damagePlane);

  const particles: THREE.Mesh[] = [];
  const particleGeometry = new THREE.BoxGeometry(.12, .12, .12);
  for (let index = 0; index < 30; index += 1) {
    const particle = new THREE.Mesh(
      particleGeometry,
      new THREE.MeshLambertMaterial({ map: index % 2 ? stone : dirt }),
    );
    particle.visible = false;
    scene.add(particle);
    particles.push(particle);
  }

  let miningSoundAt = 0;
  let previousPhase = -1;
  const startedAt = performance.now();
  const frame = (now: number): void => {
    const elapsed = (now - startedAt) / 1000;
    const walkProgress = Math.min(1, elapsed / 4.6);
    const stride = Math.sin(elapsed * 9);
    if (elapsed < 4.6) {
      steve.group.position.x = THREE.MathUtils.lerp(startX, targetX - direction * .9, walkProgress);
      steve.group.position.y = floorY + 1.15 + Math.abs(stride) * .055;
      steve.leftArm.rotation.x = stride * .72;
      steve.rightArm.rotation.x = -stride * .72;
      steve.leftLeg.rotation.x = -stride * .65;
      steve.rightLeg.rotation.x = stride * .65;
    }
    if (elapsed >= 1.55 && !blockOne.visible) {
      blockOne.visible = true;
      playQuiet(woodSoundUrl, .12);
    }
    if (elapsed >= 2.8 && !blockTwo.visible) {
      blockTwo.visible = true;
      playQuiet(woodSoundUrl, .12);
    }
    if (elapsed >= 4.25 && !torch.visible) {
      torch.visible = true;
      playQuiet(woodSoundUrl, .1);
    }
    if (elapsed >= 4.8 && elapsed < 8.9) {
      const mining = elapsed - 4.8;
      damagePlane.visible = true;
      const phase = Math.min(9, Math.floor(mining / .4));
      if (phase !== previousPhase) {
        (damagePlane.material as THREE.MeshBasicMaterial).map = destroy[phase];
        previousPhase = phase;
      }
      steve.rightArm.rotation.x = -1.15 + Math.sin(mining * 15) * 1.05;
      steve.group.rotation.y = direction > 0 ? .18 : -.18;
      if (now > miningSoundAt) {
        playQuiet(stoneSoundUrl, .16);
        miningSoundAt = now + 390;
      }
    }
    if (elapsed >= 8.9) {
      damagePlane.visible = false;
      hole.visible = true;
    }
    if (elapsed >= 9.25 && elapsed < 11.1) {
      const drop = (elapsed - 9.25) / 1.85;
      steve.group.position.y = floorY + 1.15 - drop * 3.8;
      steve.group.rotation.y += .045;
      torch.position.lerp(new THREE.Vector3(targetX, floorY - 1.8, .1), .035);
    }
    if (elapsed >= 10.5 && particles.every((particle) => !particle.visible)) {
      for (const particle of particles) {
        particle.visible = true;
        particle.position.set(
          targetX + (Math.random() - .5) * 1.8,
          floorY + (Math.random() - .5),
          .4,
        );
        particle.userData.velocity = new THREE.Vector3(
          (Math.random() - .5) * .07,
          .03 + Math.random() * .08,
          (Math.random() - .5) * .04,
        );
      }
    }
    for (const particle of particles) {
      if (!particle.visible) continue;
      particle.position.add(particle.userData.velocity as THREE.Vector3);
      (particle.userData.velocity as THREE.Vector3).y -= .003;
      particle.rotation.x += .08;
      particle.rotation.y += .05;
    }
    if (elapsed >= 11.1) steve.group.visible = false;
    if (elapsed >= 11.7) {
      const repair = Math.min(1, (elapsed - 11.7) / 1.5);
      hole.scale.setScalar(1 - repair);
      for (const object of placed) object.scale.setScalar(1 - repair);
    }

    renderer.render(scene, camera);
    if (elapsed < 13.4) requestAnimationFrame(frame);
    else {
      renderer.dispose();
      canvas.remove();
    }
  };
  requestAnimationFrame(frame);
};
