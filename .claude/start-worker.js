const path = require('path');
const workerDir = path.join(__dirname, '..', 'apps', 'worker');
process.chdir(workerDir);
// Use tsx CLI to run the worker's main.ts in watch mode
const tsxBin = require.resolve('tsx/dist/cli.mjs', { paths: [workerDir] });
// Push 'watch' and entry point to argv so tsx picks them up
process.argv = [process.argv[0], tsxBin, 'watch', path.join(workerDir, 'src', 'main.ts')];
require(tsxBin);
