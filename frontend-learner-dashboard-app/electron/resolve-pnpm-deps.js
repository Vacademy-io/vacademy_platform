#!/usr/bin/env node

/**
 * Resolves pnpm symlinks by creating a real copy of node_modules
 * This ensures electron-builder can properly package all dependencies with ASAR
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BACKUP_DIR = 'node_modules.pnpm-backup';
const NODE_MODULES = 'node_modules';

console.log('🔧 Resolving pnpm symlinks for electron-builder...\n');

// Check if we're using pnpm
if (!fs.existsSync(path.join(NODE_MODULES, '.pnpm'))) {
  console.log('✅ Not using pnpm symlinks, nothing to do.');
  process.exit(0);
}

// Check if backup already exists
if (fs.existsSync(BACKUP_DIR)) {
  console.log('⚠️  Backup already exists at:', BACKUP_DIR);
  console.log('   Run "node restore-pnpm-deps.js" first or delete it manually.\n');
  process.exit(1);
}

try {
  console.log('1️⃣  Creating backup of node_modules...');
  fs.renameSync(NODE_MODULES, BACKUP_DIR);
  console.log('   ✅ Backed up to:', BACKUP_DIR);

  console.log('\n2️⃣  Installing dependencies with npm (to get real files)...');
  // Use npm to install, which creates real directories instead of symlinks
  try {
    execSync('npm install --legacy-peer-deps', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
  } catch (npmError) {
    console.log('   ⚠️  npm install failed, trying with --force...');
    execSync('npm install --legacy-peer-deps --force', { 
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'production' }
    });
  }
  console.log('   ✅ Dependencies resolved');

  console.log('\n✅ Dependencies are now ready for electron-builder!');
  console.log('   Run your build command now.');
  console.log('   After building, run "node restore-pnpm-deps.js" to restore pnpm structure.\n');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  
  // Restore backup on error
  if (fs.existsSync(BACKUP_DIR) && !fs.existsSync(NODE_MODULES)) {
    console.log('\n🔄 Restoring backup...');
    fs.renameSync(BACKUP_DIR, NODE_MODULES);
    console.log('   ✅ Restored node_modules');
  }
  
  process.exit(1);
}

