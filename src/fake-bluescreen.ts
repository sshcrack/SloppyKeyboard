import { BrowserWindow } from 'electron';
import { createMathQuestions } from './minigame-data';

export const fakeBluescreenDocument = (): string => {
  const questions = createMathQuestions();
  const data = JSON.stringify(questions).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;background:#0078d7;color:#fff;font-family:"Segoe UI",sans-serif}
main{width:780px;margin:8vh auto}.face{font-size:112px;font-weight:300}h1{font-size:28px;font-weight:400;line-height:1.45}
.panel{margin-top:42px;padding:24px;border:2px solid #fff}label{display:block;font-size:18px}
input{margin-top:12px;width:250px;padding:8px;font-size:24px;border:0;background:#fff;color:#111}.keypad{display:grid;grid-template-columns:repeat(3,72px);gap:8px;margin-top:18px}.key{min-height:52px;border:2px solid rgba(255,255,255,.7);background:#0068bd;color:#fff;font:600 22px "Segoe UI",sans-serif;cursor:pointer}.key:hover,.key:focus-visible{background:#fff;color:#0078d7;outline:3px solid #fff;outline-offset:2px}.key--wide{grid-column:span 2}.meta{margin-top:35px;font-size:14px}
</style></head><body><main><div class="face">:(</div>
<h1>Your keyboard ran into a problem and needs your help to recover.</h1>
<div class="panel"><label id="prompt"></label><input id="answer" type="text" inputmode="numeric" readonly aria-label="Recovery answer">
<div class="keypad" aria-label="Numeric keypad">
<button class="key" data-number="1">1</button><button class="key" data-number="2">2</button><button class="key" data-number="3">3</button>
<button class="key" data-number="4">4</button><button class="key" data-number="5">5</button><button class="key" data-number="6">6</button>
<button class="key" data-number="7">7</button><button class="key" data-number="8">8</button><button class="key" data-number="9">9</button>
<button class="key" data-action="clear">C</button><button class="key" data-number="0">0</button><button class="key" data-action="backspace">⌫</button>
<button class="key key--wide" data-action="submit">Submit</button>
</div><p id="progress" aria-live="polite"></p></div><p class="meta">Use the on-screen keypad to complete the recovery checks.</p>
</main><script>
const questions=${data};let current=0;
const prompt=document.querySelector('#prompt'),answer=document.querySelector('#answer'),progress=document.querySelector('#progress');
function show(){prompt.textContent='Recovery check: '+questions[current].text+' = ?';progress.textContent='Check '+(current+1)+' of 3';answer.value=''}
function submit(){if(Number(answer.value)===questions[current].answer){current++;if(current===3){document.title='BLUESCREEN_RECOVERED';return}show()}else{document.title='BLUESCREEN_FATAL_MISTAKE'}}
document.querySelector('.keypad').addEventListener('click',e=>{const button=e.target.closest('button');if(!button)return;const{number,action}=button.dataset;if(number){answer.value+=number;return}if(action==='clear'){answer.value='';return}if(action==='backspace'){answer.value=answer.value.slice(0,-1);return}if(action==='submit')submit()});show();
</script></body></html>`;
};

export const openFakeBluescreen = (
  onCreated?: (window: BrowserWindow) => void,
  onFatalMistake?: () => void,
): Promise<void> => new Promise((resolve) => {
  let allowClose = false;
  const window = new BrowserWindow({
    fullscreen: true,
    kiosk: true,
    frame: false,
    focusable: true,
    alwaysOnTop: true,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  onCreated?.(window);
  window.on('close', (event) => {
    if (!allowClose) event.preventDefault();
  });
  window.on('closed', resolve);
  window.on('page-title-updated', (event, title) => {
    event.preventDefault();
    if (title === 'BLUESCREEN_RECOVERED') {
      allowClose = true;
      window.close();
    } else if (title === 'BLUESCREEN_FATAL_MISTAKE') {
      onFatalMistake?.();
    }
  });
  window.once('ready-to-show', () => {
    // Explicitly enter fullscreen before the window is shown so it never
    // briefly appears as a regular desktop window.
    window.setFullScreen(true);
    window.show();
    window.focus();
  });
  void window.loadURL(`data:text/html;charset=utf-8,${
    encodeURIComponent(fakeBluescreenDocument())
  }`);
});
