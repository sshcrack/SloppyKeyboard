const { existsSync, mkdirSync } = require('fs');
const { join } = require('path');
const { spawnSync } = require('child_process');

const root = join(__dirname, '..');
const compiler = join(process.env.WINDIR || 'C:\\Windows', 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
const outputFolder = join(root, 'goose-mod', 'test-bin');
const output = join(outputFolder, 'DeferredTaskGateTests.exe');
if (!existsSync(compiler)) process.exit(1);
mkdirSync(outputFolder, { recursive: true });
let result = spawnSync(compiler, [
  '/nologo', `/out:${output}`,
  join(root, 'goose-mod', 'DeferredTaskGate.cs'),
  join(root, 'goose-mod', 'DeferredTaskGateTests.cs'),
], { stdio: 'inherit', windowsHide: true });
if (result.status === 0) {
  result = spawnSync(output, [], { stdio: 'inherit', windowsHide: true });
}
process.exit(result.status ?? 1);
