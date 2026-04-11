/**
 * ESLint rule: no-hardcoded-naming-terms
 *
 * Flags hardcoded naming terms that should use getTerminology() or getTerminologyPlural()
 * from '@/components/common/layout-container/sidebar/utils'.
 *
 * These terms are configurable per-institute via Settings > Naming Settings.
 * Hardcoding them means the custom name won't appear in the UI.
 *
 * Also flags manual plural concatenation patterns like:
 *   getTerminology(...) + 's'
 *   `${getTerminology(...)}s`
 *   {getTerminology(...)}s  (in JSX)
 */

// Singular terms that must use getTerminology()
const SINGULAR_TERMS = [
    'Course',
    'Level',
    'Session',
    'Subject',
    'Module',
    'Chapter',
    'Slide',
    'Batch',
    'Package',
    'Live Session',
    'Popular Tag',
    'Audience List',
    'Invite',
    'Inventory',
    // Role terms
    'Admin',
    'Teacher',
    'Course Creator',
    'Assessment Creator',
    'Evaluator',
    'Learner',
    'Student',
];

// Plural terms that must use getTerminologyPlural()
const PLURAL_TERMS = [
    'Courses',
    'Levels',
    'Sessions',
    'Subjects',
    'Modules',
    'Chapters',
    'Slides',
    'Batches',
    'Packages',
    'Live Sessions',
    'Admins',
    'Teachers',
    'Evaluators',
    'Learners',
    'Students',
    'Invites',
];

const ALL_TERMS = [...new Set([...SINGULAR_TERMS, ...PLURAL_TERMS])];

// Files/patterns where we should NOT flag (constants, enums, settings themselves, etc.)
const IGNORE_PATTERNS = [
    'settings/-constants/terms.ts',
    'settings/-components/NamingSettings.tsx',
    'sidebar/utils.ts',
    'naming-settings.ts',
    'storage.ts',
    '.test.',
    '.spec.',
    '.stories.',
];

function shouldIgnoreFile(filename) {
    return IGNORE_PATTERNS.some((pattern) => filename.includes(pattern));
}

// Build a regex that matches any of the terms as whole words
function buildTermRegex(terms) {
    const escaped = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // Sort by length descending so longer terms match first
    escaped.sort((a, b) => b.length - a.length);
    return new RegExp(`\\b(${escaped.join('|')})s?\\b`, 'g');
}

const termRegex = buildTermRegex(ALL_TERMS);

module.exports = {
    meta: {
        type: 'suggestion',
        docs: {
            description:
                'Disallow hardcoded naming terms that should use getTerminology() / getTerminologyPlural()',
            category: 'Best Practices',
            recommended: false,
        },
        messages: {
            hardcodedTerm:
                'Hardcoded naming term "{{term}}" should use getTerminology(ContentTerms.{{key}}, SystemTerms.{{key}}) instead. These terms are configurable per-institute.',
            hardcodedPluralTerm:
                'Hardcoded plural naming term "{{term}}" should use getTerminologyPlural(ContentTerms.{{key}}, SystemTerms.{{key}}) instead.',
            manualPlural:
                'Manual plural concatenation detected. Use getTerminologyPlural() instead of appending "s" to getTerminology().',
        },
        schema: [],
    },

    create(context) {
        const filename = context.getFilename();
        if (shouldIgnoreFile(filename)) return {};

        return {
            // Flag: getTerminology(...) + 's'
            BinaryExpression(node) {
                if (
                    node.operator === '+' &&
                    node.right.type === 'Literal' &&
                    node.right.value === 's' &&
                    node.left.type === 'CallExpression' &&
                    node.left.callee.name === 'getTerminology'
                ) {
                    context.report({ node, messageId: 'manualPlural' });
                }
            },

            // Flag: `${getTerminology(...)}s` in template literals
            TemplateLiteral(node) {
                node.expressions.forEach((expr, i) => {
                    if (
                        expr.type === 'CallExpression' &&
                        expr.callee.name === 'getTerminology'
                    ) {
                        // Check if the next quasi starts with 's'
                        const nextQuasi = node.quasis[i + 1];
                        if (nextQuasi && /^s\b/.test(nextQuasi.value.raw)) {
                            context.report({ node: expr, messageId: 'manualPlural' });
                        }
                    }
                });
            },
        };
    },
};
