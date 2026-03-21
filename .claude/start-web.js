const path = require('path');
const webDir = path.join(__dirname, '..', 'apps', 'web');
process.chdir(webDir);
// Resolve next from the web app's node_modules
const nextBin = require.resolve('next/dist/bin/next', { paths: [webDir] });
require(nextBin);
