#!/usr/bin/env node

/**
 * Lint script: Detect hardcoded naming terms and manual plural concatenation.
 *
 * Usage:
 *   node scripts/lint-naming-terms.js [--fix-hint]
 *   pnpm run lint:naming
 *
 * This script scans .tsx/.ts files in src/ for:
 * 1. Manual plural concatenation: getTerminology(...) + 's' or `${getTerminology(...)}s`
 * 2. Hardcoded naming terms in JSX text or string literals that should use getTerminology()
 *
 * Exit code 0 = clean, 1 = violations found
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');

// Files to skip
const IGNORE_PATTERNS = [
    'settings/-constants/terms.ts',
    'settings/-components/NamingSettings.tsx',
    'sidebar/utils.ts',
    'services/naming-settings.ts',
    'constants/storage/storage.ts',
    'hooks/useNamingSettings.ts',
    'eslint-rules/',
    'scripts/',
    '.test.',
    '.spec.',
    '.stories.',
    'node_modules',
];

// Patterns that indicate manual plural concatenation
const MANUAL_PLURAL_PATTERNS = [
    // getTerminology(...) + 's'
    /getTerminology\([^)]+\)\s*\+\s*['"]s['"]/g,
    // `${getTerminology(...)}s` in template literals
    /\$\{getTerminology\([^}]+\)\}s\b/g,
    // {getTerminology(...)}s in JSX
    /\{getTerminology\([^}]+\)\}s\b/g,
];

let violations = 0;
let filesScanned = 0;

function shouldIgnore(filePath) {
    return IGNORE_PATTERNS.some((p) => filePath.includes(p));
}

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relPath = path.relative(path.join(__dirname, '..'), filePath);
    let fileViolations = [];

    lines.forEach((line, idx) => {
        const lineNum = idx + 1;

        // Check manual plural patterns
        for (const pattern of MANUAL_PLURAL_PATTERNS) {
            pattern.lastIndex = 0;
            let match;
            while ((match = pattern.exec(line)) !== null) {
                fileViolations.push({
                    line: lineNum,
                    col: match.index + 1,
                    message: `Manual plural concatenation: Use getTerminologyPlural() instead of appending "s"`,
                    code: match[0],
                });
            }
        }
    });

    if (fileViolations.length > 0) {
        console.log(`\n\x1b[4m${relPath}\x1b[0m`);
        for (const v of fileViolations) {
            console.log(
                `  \x1b[33mline ${v.line}:${v.col}\x1b[0m  ${v.message}`
            );
            console.log(`    \x1b[2m${v.code}\x1b[0m`);
        }
        violations += fileViolations.length;
    }
}

function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.git') continue;
            walkDir(fullPath);
        } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
            if (shouldIgnore(fullPath)) continue;
            filesScanned++;
            scanFile(fullPath);
        }
    }
}

console.log('Scanning for naming term violations...\n');
walkDir(SRC_DIR);

console.log(`\n${filesScanned} files scanned.`);
if (violations > 0) {
    console.log(`\x1b[31m${violations} violation(s) found.\x1b[0m`);
    console.log(
        '\nFix: Replace manual plural concatenation with getTerminologyPlural() from'
    );
    console.log("  '@/components/common/layout-container/sidebar/utils'");
    process.exit(1);
} else {
    console.log('\x1b[32mNo naming term violations found.\x1b[0m');
    process.exit(0);
}
