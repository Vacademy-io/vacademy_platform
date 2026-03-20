#!/usr/bin/env node

/**
 * Restores pnpm symlinks after building with electron-builder
 */

const fs = require('fs');
const path = require('path');

const BACKUP_DIR = 'node_modules.pnpm-backup';
const NODE_MODULES = 'node_modules';

console.log('🔄 Restoring pnpm symlinks...\n');

if (!fs.existsSync(BACKUP_DIR)) {
  console.log('⚠️  No backup found at:', BACKUP_DIR);
  console.log('   Nothing to restore.');
  process.exit(0);
}

try {
  // Remove the npm-installed node_modules
  if (fs.existsSync(NODE_MODULES)) {
    console.log('1️⃣  Removing npm node_modules...');
    fs.rmSync(NODE_MODULES, { recursive: true, force: true });
    console.log('   ✅ Removed');
  }

  // Restore pnpm backup
  console.log('\n2️⃣  Restoring pnpm node_modules...');
  fs.renameSync(BACKUP_DIR, NODE_MODULES);
  console.log('   ✅ Restored');

  console.log('\n✅ pnpm structure restored successfully!\n');

} catch (error) {
  console.error('\n❌ Error:', error.message);
  console.log('\nYou may need to manually restore by running:');
  console.log('  rm -rf node_modules && mv node_modules.pnpm-backup node_modules\n');
  process.exit(1);
}

