const path = require('path');
const { execSync } = require('child_process');
const { spawn } = require('child_process');

const workerDir = path.join(__dirname, '..', 'apps', 'worker');

// Find the tsx package's actual location on disk
const tsxPkgPath = require.resolve('tsx/package.json', { paths: [workerDir] });
const tsxDir = path.dirname(tsxPkgPath);
const tsxCli = path.join(tsxDir, 'dist', 'cli.mjs');
const entryFile = path.join(workerDir, 'src', 'main.ts');

// Spawn node with tsx CLI as an ESM module
const child = spawn(process.execPath, [tsxCli, 'watch', entryFile], {
  cwd: workerDir,
  stdio: 'inherit',
  env: { ...process.env },
});

child.on('exit', (code) => process.exit(code || 0));
process.on('SIGTERM', () => child.kill('SIGTERM'));
process.on('SIGINT', () => child.kill('SIGINT'));
