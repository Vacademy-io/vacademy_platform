export const DEFAULT_CODE = {
    python: `# Welcome to Python Code Editor
print("Hello, World!")

# Try some basic operations
numbers = [1, 2, 3, 4, 5]
sum_numbers = sum(numbers)
print(f"Sum of numbers: {sum_numbers}")

# Uncomment below lines to test interactive input:
# name = input("Enter your name: ")
# print(f"Hello, {name}! Welcome to coding!")`,
    javascript: `// Welcome to JavaScript Code Editor
console.log("Hello, World!");

// Try some basic operations
const numbers = [1, 2, 3, 4, 5];
const sum = numbers.reduce((a, b) => a + b, 0);
console.log(\`Sum of numbers: \${sum}\`); `,
};

export const CODE_EDITOR_CONFIG = {
    DEBOUNCE_DELAY: 1500, // 1.5 seconds
    EDITOR_HEIGHT: '500px',
    DEFAULT_FONT_SIZE: 14,
    SCROLLBAR_SIZE: 8,
};

export const SUPPORTED_LANGUAGES = ['python'] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
