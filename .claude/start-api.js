const path = require('path');
const apiDir = path.join(__dirname, '..', 'apps', 'api');
process.chdir(apiDir);
process.argv.push('start', '--watch');
const nestBin = require.resolve('@nestjs/cli/bin/nest.js', { paths: [apiDir] });
require(nestBin);
