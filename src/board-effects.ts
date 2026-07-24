export interface ConfettiParticle {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  rotation: number;
  spin: number;
  color: string;
  bornAt: number;
  lifetime: number;
}

const COLORS = ['#ffff00', '#ff00ff', '#00ffff', '#ff0000', '#ffffff'];

export const createConfettiBurst = (
  x: number,
  y: number,
  now: number,
  random: () => number = Math.random,
): ConfettiParticle[] => Array.from({ length: 42 }, (_, index) => ({
  x,
  y,
  velocityX: (random() - 0.5) * (180 + random() * 300),
  velocityY: -(130 + random() * 250),
  rotation: random() * Math.PI,
  spin: (random() - 0.5) * 12,
  color: COLORS[index % COLORS.length],
  bornAt: now,
  lifetime: 950 + random() * 650,
}));

export const drawConfetti = (
  context: CanvasRenderingContext2D,
  particles: ConfettiParticle[],
  now: number,
): ConfettiParticle[] => {
  const active = particles.filter((particle) =>
    now - particle.bornAt < particle.lifetime);
  for (const particle of active) {
    const age = (now - particle.bornAt) / 1000;
    const progress = (now - particle.bornAt) / particle.lifetime;
    context.save();
    context.globalAlpha = Math.min(1, (1 - progress) * 1.8);
    context.translate(
      particle.x + particle.velocityX * age,
      particle.y + particle.velocityY * age + 260 * age * age,
    );
    context.rotate(particle.rotation + particle.spin * age);
    context.fillStyle = particle.color;
    context.fillRect(-5, -3, 10, 6);
    context.strokeStyle = '#000000';
    context.lineWidth = 1;
    context.strokeRect(-5, -3, 10, 6);
    context.restore();
  }
  return active;
};
