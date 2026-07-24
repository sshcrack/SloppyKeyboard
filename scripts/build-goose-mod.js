const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const root = join(__dirname, '..');
const api = join(root, 'goose-mod', 'lib', 'GooseModdingAPI.dll');
const compiler = join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const outputFolder = join(root, 'assets', 'goose-mod');
const output = join(outputFolder, 'SloppyKeyboard.dll');
if (!existsSync(api)) {
  console.error('Missing goose-mod/lib/GooseModdingAPI.dll. Copy it from Desktop Goose v0.31 before building.');
  process.exit(1);
}
if (!existsSync(compiler)) {
  console.error('The .NET Framework C# compiler is missing. Install the .NET Framework 4.5.2 Developer Pack.');
  process.exit(1);
}
mkdirSync(outputFolder, { recursive: true });
const result = spawnSync(compiler, [
  '/nologo', '/target:library', `/out:${output}`,
  `/reference:${api}`, '/reference:System.Windows.Forms.dll', '/reference:System.Drawing.dll',
  join(root, 'goose-mod', 'ModEntryPoint.cs'),
  join(root, 'goose-mod', 'SloppyBallHuntTask.cs'),
], { stdio: 'inherit', windowsHide: true });
process.exit(result.status ?? 1);
