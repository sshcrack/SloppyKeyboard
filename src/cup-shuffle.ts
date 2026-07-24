import './cup-shuffle.css';
import { createCupSwaps } from './cup-shuffle-model';

const cups = Array.from(document.querySelectorAll<HTMLButtonElement>('.cup-wrap'));
const hand = document.querySelector<HTMLElement>('#hand') as HTMLElement;
const message = document.querySelector<HTMLElement>('#message') as HTMLElement;
const timer = document.querySelector<HTMLElement>('#timer') as HTMLElement;
const insane = new URLSearchParams(location.search).get('insane') === '1';
const swaps = createCupSwaps(insane ? 26 : 12);
const positions = [0, 1, 2, 3, 4];
const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const placeCup = (cup: number, animate = true): void => {
  cups[cup].classList.toggle('moving', animate);
  cups[cup].style.setProperty('--slot', String(positions[cup]));
};

const pointHand = (slot: number, grabbing: boolean): void => {
  hand.style.setProperty('--hand-slot', String(slot));
  hand.classList.toggle('grab', grabbing);
};

const perform = async (): Promise<void> => {
  cups.forEach((_cup, index) => placeCup(index, false));
  await wait(450);
  for (let index = 0; index < cups.length; index += 1) {
    pointHand(index, false); cups[index].classList.add('reveal');
    message.textContent = cups[index].querySelector('em')?.textContent ?? '';
    await wait(520); cups[index].classList.remove('reveal');
  }
  message.textContent = insane ? 'UNFAIR MODE DETECTED. GOOD LUCK.' : 'WATCH THE HAND. TRUST NOTHING.';
  await wait(500);
  for (let index = 0; index < swaps.length; index += 1) {
    const [a, b] = swaps[index];
    pointHand(positions[a], true); await wait(Math.max(55, 260 - index * 13));
    [positions[a], positions[b]] = [positions[b], positions[a]];
    placeCup(a); placeCup(b);
    pointHand(positions[a], true); await wait(Math.max(80, 390 - index * 19));
  }
  hand.classList.add('gone'); cups.forEach((cup) => cup.classList.add('ready'));
  message.textContent = 'PICK ONE. IT PROBABLY REMEMBERS YOU.';
};

let remaining = 20;
setInterval(() => { remaining = Math.max(0, remaining - 1); timer.textContent = String(remaining).padStart(2, '0'); }, 1000);
cups.forEach((cup) => cup.addEventListener('click', () => {
  if (!cup.classList.contains('ready')) return;
  cups.forEach((item) => item.classList.remove('ready'));
  cup.classList.add('chosen'); message.textContent = 'CONSEQUENCE SELECTED.';
  window.sloppyKeyboard.selectCup(Number(cup.dataset.cup));
}));
void perform();
