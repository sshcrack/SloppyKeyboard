import './goose-setup.css';
const detail = document.querySelector<HTMLElement>('#detail') as HTMLElement;
const progress = document.querySelector<HTMLElement>('#progress') as HTMLElement;
const percent = document.querySelector<HTMLElement>('#percent') as HTMLElement;
const phase = document.querySelector<HTMLElement>('#phase') as HTMLElement;
window.sloppyKeyboard.onGooseSetupProgress((state) => {
  const value = Math.max(0, Math.min(100, state.percent));
  detail.textContent = state.detail;
  progress.style.setProperty('--progress', `${value}%`);
  progress.setAttribute('aria-valuenow', String(value));
  percent.textContent = `${Math.round(value)}%`;
  phase.textContent = state.phase.toUpperCase();
  document.body.classList.toggle('done', state.phase === 'done');
  document.body.classList.toggle('error', state.phase === 'error');
});
