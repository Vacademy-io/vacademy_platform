#!/usr/bin/env node
/**
 * One-time setup: point git at the repo's shared hooks so the Vacademy
 * design-system commit gate (.husky/pre-commit) runs on every commit.
 *
 * Run once per clone:  node scripts/setup-hooks.mjs
 *
 * (git stores hook paths locally per clone, so this can't be auto-shared —
 * each teammate runs it once after cloning.)
 */
import { execSync } from 'node:child_process';

try {
  execSync('git config core.hooksPath .husky', { stdio: 'inherit' });
  const current = execSync('git config --get core.hooksPath').toString().trim();
  if (current === '.husky') {
    console.log('✓ Git hooks enabled (core.hooksPath = .husky).');
    console.log('  The design-system commit gate will now run on `git commit`.');
  } else {
    console.error('✗ Unexpected core.hooksPath:', current);
    process.exit(1);
  }
} catch (err) {
  console.error('✗ Failed to configure git hooks:', err.message);
  console.error('  Run this from inside the repository, or set it manually:');
  console.error('    git config core.hooksPath .husky');
  process.exit(1);
}
