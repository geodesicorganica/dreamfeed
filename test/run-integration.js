'use strict';
// Integration test runner. Requires DREAMFEED_STAKEPORT_ROOT env var.
//
// Before running the test suite it writes a temp project-config.json pointing
// at STAKEPORT_ROOT and runs audit.js so the sidecar (audit-status.json) exists
// for Health-tab assertions. Restores the prior config when done.
const root = process.env.DREAMFEED_STAKEPORT_ROOT;
if (!root) {
  console.log('Set DREAMFEED_STAKEPORT_ROOT first:');
  console.log('  PowerShell: $env:DREAMFEED_STAKEPORT_ROOT = "c:\\Projects\\stakeport_os"');
  console.log('  Then: npm run test:integration');
  process.exit(0);
}

const { execFileSync } = require('child_process');
const { readdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } = require('fs');
const { join } = require('path');

const APP_ROOT = join(__dirname, '..');
const configPath = join(APP_ROOT, 'project-config.json');
const hadConfig = existsSync(configPath);
const prevConfig = hadConfig ? readFileSync(configPath, 'utf8') : null;

writeFileSync(configPath, JSON.stringify({ root, recent: [] }, null, 2), 'utf8');
try {
  execFileSync(process.execPath, [join(APP_ROOT, 'audit.js')], { stdio: 'inherit', env: process.env });
} finally {
  if (hadConfig && prevConfig) writeFileSync(configPath, prevConfig, 'utf8');
  else if (!hadConfig) try { unlinkSync(configPath); } catch { /* ok */ }
}

const files = readdirSync(join(__dirname, 'integration'))
  .filter(f => f.endsWith('.test.js'))
  .map(f => join(__dirname, 'integration', f));

execFileSync(process.execPath, ['--test', ...files], { stdio: 'inherit', env: process.env });
