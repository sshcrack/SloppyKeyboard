const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const src = path.join(root, 'native', 'keyboard-blocker.cpp');
const out = path.join(root, 'native', 'keyboard-blocker.exe');

if (fs.existsSync(out) && fs.statSync(out).mtimeMs >= fs.statSync(src).mtimeMs) {
  process.exit(0);
}

const candidates = [
  process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
  process.env['ProgramFiles'] || 'C:\\Program Files',
];

function findVcvars() {
  for (const base of candidates) {
    const vsDir = path.join(base, 'Microsoft Visual Studio');
    try {
      const versions = fs.readdirSync(vsDir);
      for (const ver of versions) {
        const vcvars = path.join(vsDir, ver, 'BuildTools', 'VC', 'Auxiliary', 'Build', 'vcvars64.bat');
        if (fs.existsSync(vcvars)) return vcvars;
      }
    } catch {}
  }
  return null;
}

try {
  const vcvars = findVcvars();
  if (!vcvars) {
    console.error('error: Visual Studio Build Tools 2022+ not found');
    console.error('Install from: https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2026');
    console.error('Make sure to select "Desktop development with C++" workload.');
    process.exit(1);
  }

  if (!fs.existsSync(src)) {
    console.error(`error: source not found at ${src}`);
    process.exit(1);
  }

  const cmd = `"${vcvars}" && cl /EHsc /O2 /Fe:"${out}" "${src}" /link /SUBSYSTEM:CONSOLE user32.lib`;
  execSync(cmd, { stdio: 'inherit', shell: 'cmd.exe' });
  console.log(`\nbuilt: ${path.relative(root, out)}`);
} catch {
  process.exit(1);
}
