import './index.css';
import './debug-minigames.css';
import './animations.css';
import { BoardPhysics } from './board-physics';
import { BoardRenderer, LANDING_FLASH_MS } from './board-renderer';
import { BoardState } from './board-state';
import { MinigameReel } from './minigame-reel';
import type { MinigameId, SpecialKey } from './contracts';
import { MINIGAMES } from './minigame-data';
import { SkillCheck } from './skill-check';
import { DiceRoll } from './dice-roll';
import {
  HIGH_SCORE_STORAGE_KEY,
  pressBackspaceRepeatedly,
  readHighScore,
  resetScore,
  scoreLetter,
} from './arcade-state';

const required = <T extends Element>(selector: string): T => {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing interface element: ${selector}`);
  return element;
};

const canvas = required<HTMLCanvasElement>('#board');
const closeButton = required<HTMLButtonElement>('#close');
const minimizeButton = required<HTMLButtonElement>('#minimize');
const ballCount = required<HTMLElement>('#ball-count');
const scoreValue = required<HTMLElement>('#score');
const highScoreValue = required<HTMLElement>('#high-score');
const highScoreBox = required<HTMLElement>('#high-score-box');
const status = required<HTMLElement>('#status');
const typedValue = required<HTMLElement>('#typed-value');
const selector = new MinigameReel(required<HTMLElement>('#selector'));
const skillCheck = new SkillCheck(required<HTMLElement>('#skill-check'));
const diceRoll = new DiceRoll(required<HTMLElement>('#dice-roll'));
const boardShell = required<HTMLElement>('.board-shell');
const hitEffects = document.createElement('div');
hitEffects.className = 'hit-effects';
boardShell.append(hitEffects);
const specialKeyButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>('[data-special-key]'),
);
const debugPanel = required<HTMLElement>('#debug-minigames');
const debugButtons = required<HTMLElement>('#debug-minigame-buttons');

const board = new BoardState();
const rendererRef: { current?: BoardRenderer } = {};
let phase:
  | 'ready'
  | 'highlight'
  | 'selector'
  | 'skill-check'
  | 'debug'
  | 'dice-roll' = 'ready';
let scoreState = {
  score: 0,
  highScore: (() => {
    try {
      return readHighScore(localStorage.getItem(HIGH_SCORE_STORAGE_KEY));
    } catch {
      return 0;
    }
  })(),
};
let recordTimer: number | undefined;
let completionTimer: number | undefined;

const renderScore = (newHighScore = false, animate = true): void => {
  scoreValue.textContent = String(scoreState.score).padStart(6, '0');
  highScoreValue.textContent = String(scoreState.highScore).padStart(6, '0');
  if (animate) {
    scoreValue.classList.remove('punch');
    void scoreValue.offsetWidth;
    scoreValue.classList.add('punch');
  }
  if (!newHighScore) return;
  highScoreBox.classList.remove('new-record');
  void highScoreBox.offsetWidth;
  highScoreBox.classList.add('new-record');
  if (recordTimer !== undefined) window.clearTimeout(recordTimer);
  recordTimer = window.setTimeout(
    () => highScoreBox.classList.remove('new-record'),
    2200,
  );
};

const showLetterEffects = (slot: number): void => {
  const popup = document.createElement('span');
  popup.className = 'point-popup';
  popup.textContent = '+100';
  popup.style.left = `${slot * 88 + 2}px`;
  hitEffects.append(popup);
  for (let index = 0; index < 10; index += 1) {
    const spark = document.createElement('i');
    spark.className = 'pixel-spark';
    spark.style.left = `${slot * 88 + 41}px`;
    spark.style.setProperty('--spark', index % 2 ? '#ffff00' : '#ffffff');
    spark.style.setProperty('--spark-x', `${(index % 5 - 2) * 18}px`);
    spark.style.setProperty('--spark-y', `${-28 - Math.floor(index / 5) * 34}px`);
    hitEffects.append(spark);
    window.setTimeout(() => spark.remove(), 600);
  }
  window.setTimeout(() => popup.remove(), 760);
};

const updateControls = (): void => {
  ballCount.textContent = String(board.activeBalls).padStart(2, '0');
  specialKeyButtons.forEach((button) => {
    button.disabled = phase !== 'ready' || board.activeBalls > 0;
  });
  if (phase === 'highlight') status.textContent = 'REGISTERING HIT...';
  else if (phase === 'selector') status.textContent = 'MYSTERY EVENT ACTIVE';
  else if (phase === 'skill-check') status.textContent = 'SPECIAL KEY CHECK ACTIVE';
  else if (phase === 'debug') status.textContent = 'DEBUG MINIGAME ACTIVE';
  else if (phase === 'dice-roll') status.textContent = 'BACKSPACE DICE ACTIVE';
  else if (board.specialPending) {
    status.textContent = `MYSTERY ARMED · ${board.activeBalls} BALLS REMAIN`;
  }
  else {
    status.textContent = board.activeBalls > 0
      ? 'VOLLEY IN PROGRESS'
      : 'READY · CLICK THE DROP RAIL';
  }
};

const showStatus = (message: string, isError = false): void => {
  status.textContent = message;
  status.classList.toggle('error', isError);
  if (isError) {
    window.setTimeout(() => status.classList.remove('error'), 1800);
  }
};

const completeVolley = async (): Promise<void> => {
  if (!board.specialPending) {
    board.reroll();
    rendererRef.current?.resetSpecial();
    phase = 'ready';
    updateControls();
    return;
  }
  phase = 'selector';
  updateControls();
  try {
    const draw = await window.sloppyKeyboard.drawMinigame();
    const winner = await selector.spin(draw);
    const result = await window.sloppyKeyboard.runMinigame(winner.id);
    selector.hide();
    showStatus(
      result.message ?? (
        result.status === 'completed' ? 'MINIGAME COMPLETE' : 'MINIGAME ENDED'
      ),
      result.status === 'failed',
    );
  } catch {
    selector.hide();
    showStatus('MINIGAME FAILED SAFELY', true);
  } finally {
    board.reroll();
    rendererRef.current?.resetSpecial();
    phase = 'ready';
    window.setTimeout(updateControls, 1800);
  }
};

const finishAfterHighlight = (): void => {
  phase = 'highlight';
  updateControls();
  completionTimer = window.setTimeout(() => {
    completionTimer = undefined;
    void completeVolley();
  }, LANDING_FLASH_MS);
};

const launchSkillCheckPenalty = async (): Promise<void> => {
  phase = 'selector';
  updateControls();
  try {
    const draw = await window.sloppyKeyboard.drawMinigame();
    const winner = await selector.spin(draw);
    const result = await window.sloppyKeyboard.runMinigame(winner.id);
    selector.hide();
    phase = 'ready';
    updateControls();
    showStatus(
      result.message ?? 'SKILL CHECK PENALTY COMPLETE',
      result.status === 'failed',
    );
  } catch {
    selector.hide();
    phase = 'ready';
    updateControls();
    showStatus('SKILL CHECK PENALTY FAILED SAFELY', true);
  }
};

const runSpecialKey = async (key: SpecialKey): Promise<void> => {
  if (phase !== 'ready' || board.activeBalls > 0) {
    showStatus('WAIT FOR THE CURRENT VOLLEY');
    return;
  }
  phase = 'skill-check';
  updateControls();
  const success = await skillCheck.run(key);
  phase = 'ready';
  updateControls();
  if (!success) {
    showStatus(`${key.toUpperCase()} BLOCKED · 3 STRIKES`, true);
    await launchSkillCheckPenalty();
    return;
  }
  const result = await window.sloppyKeyboard.pressSpecialKey(key);
  showStatus(
    result.ok
      ? `${key.toUpperCase()} TRANSMITTED`
      : `${key.toUpperCase()} INPUT BLOCKED`,
    !result.ok,
  );
};

const runBackspaceDice = async (): Promise<void> => {
  if (phase !== 'ready' || board.activeBalls > 0) {
    showStatus('WAIT FOR THE CURRENT VOLLEY');
    return;
  }
  phase = 'dice-roll';
  updateControls();
  let count = 0;
  let message = 'BACKSPACE DICE FAILED SAFELY';
  let isError = true;
  try {
    count = await diceRoll.roll();
    diceRoll.setDispatching();
    const ok = await pressBackspaceRepeatedly(
      count,
      () => window.sloppyKeyboard.pressSpecialKey('backspace'),
    );
    message = ok
      ? `BACKSPACE ×${count} TRANSMITTED`
      : `BACKSPACE ×${count} INCOMPLETE · INPUT BLOCKED`;
    isError = !ok;
  } catch {
    message = 'BACKSPACE DICE FAILED SAFELY';
  } finally {
    diceRoll.hide();
    phase = 'ready';
    updateControls();
    showStatus(message, isError);
  }
};

const runDebugMinigame = async (id: MinigameId): Promise<void> => {
  if (phase !== 'ready' || board.activeBalls > 0) {
    showStatus('DEBUG LAUNCH BLOCKED · WAIT FOR IDLE BOARD', true);
    return;
  }
  phase = 'debug';
  updateControls();
  try {
    const result = await window.sloppyKeyboard.debugRunMinigame(id);
    phase = 'ready';
    updateControls();
    showStatus(
      result.message ?? 'DEBUG MINIGAME ENDED',
      result.status === 'failed',
    );
  } catch {
    phase = 'ready';
    updateControls();
    showStatus('DEBUG MINIGAME FAILED SAFELY', true);
  }
};

void window.sloppyKeyboard.debugMode().then((enabled) => {
  if (!enabled) return;
  debugPanel.hidden = false;
  for (const game of MINIGAMES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = game.label;
    button.addEventListener('click', () => void runDebugMinigame(game.id));
    debugButtons.append(button);
  }
});

const physics = new BoardPhysics({
  onLanding: (_ballId, slot) => {
    const landing = board.land(slot);
    rendererRef.current?.flash(slot, landing.value);
    if (landing.value.kind === 'letter') {
      const character = landing.value.character;
      const transition = scoreLetter(scoreState);
      scoreState = transition;
      if (transition.newHighScore) {
        try {
          localStorage.setItem(
            HIGH_SCORE_STORAGE_KEY,
            String(transition.highScore),
          );
        } catch {
          // Scoring remains usable when storage is unavailable.
        }
      }
      renderScore(transition.newHighScore);
      showLetterEffects(slot);
      typedValue.textContent = character;
      typedValue.classList.remove('pop');
      void typedValue.offsetWidth;
      typedValue.classList.add('pop');
      showStatus(`TRANSMITTING “${character}”`);
      void window.sloppyKeyboard.typeCharacter(character).then((result) => {
        if (!result.ok) showStatus('INPUT BLOCKED · FOCUS A NORMAL WINDOW', true);
      });
    } else {
      scoreState = resetScore(scoreState);
      renderScore();
      rendererRef.current?.celebrateSpecial(slot);
      showStatus('MYSTERY SLOT · SCORE RESET · FINISHING VOLLEY');
    }
    if (landing.volleyFinished) finishAfterHighlight();
    else updateControls();
  },
  onAbandon: () => {
    if (board.abandon()) void completeVolley();
    else updateControls();
  },
});

const renderer = new BoardRenderer(canvas, physics, () => board.slots);
rendererRef.current = renderer;

canvas.addEventListener('pointerdown', (event) => {
  if (!renderer.isLaunchRail(event.clientY)) return;
  if (phase !== 'ready') {
    showStatus('WAIT FOR THE MACHINE TO RESET');
    return;
  }
  if (physics.launch(renderer.toBoardX(event.clientX))) {
    board.launch();
    updateControls();
  } else showStatus('BALL LIMIT REACHED');
});

closeButton.addEventListener('click', () => window.sloppyKeyboard.closeWindow());
minimizeButton.addEventListener('click', () =>
  window.sloppyKeyboard.minimizeWindow());
specialKeyButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.specialKey as SpecialKey;
    if (key === 'backspace') void runBackspaceDice();
    else void runSpecialKey(key);
  });
});
window.addEventListener('beforeunload', () => {
  physics.stop();
  skillCheck.stop();
  if (completionTimer !== undefined) window.clearTimeout(completionTimer);
  if (recordTimer !== undefined) window.clearTimeout(recordTimer);
});

renderScore(false, false);
updateControls();
physics.start();
renderer.start();
