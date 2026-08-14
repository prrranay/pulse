const { execSync } = require('child_process');

try {
  // Check if @prisma/client is resolvable in the current node_modules environment
  require.resolve('@prisma/client');
  console.log('Pulse Postinstall: @prisma/client is present. Generating Prisma client...');
  execSync('npm run db:generate', { stdio: 'inherit' });
} catch (err) {
  console.log('Pulse Postinstall: @prisma/client is not installed (e.g. pruned workspace for frontend build). Skipping Prisma client generation.');
}
