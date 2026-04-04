// Run once: node generate-vapid-keys.js
// Copy the output into your Supabase secrets and app.js
const { execSync } = require('child_process');

try {
  execSync('npx web-push generate-vapid-keys', { stdio: 'inherit' });
} catch {
  console.error('Failed. Try: npm install -g web-push && web-push generate-vapid-keys');
}
