import { SupportedLanguage, DEFAULT_CODE } from '../constants/code-editor';
import { CodeEditorData, AllLanguagesData } from './code-editor-types';

export interface CodeExecutionResult {
    output: string;
    needsInput: boolean;
    hasError?: boolean;
}

// Pyodide instance - will be loaded lazily
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodide: any = null;
let isPyodideLoading = false;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideLoadPromise: Promise<any> | null = null;

// Console output buffer
let consoleOutput: string[] = [];

// Custom stdout/stderr handler
const stdout = (msg: unknown) => {
    consoleOutput.push(String(msg));
    console.log(msg);
};

// Add timeout for Pyodide loading
const PYODIDE_LOAD_TIMEOUT = 30000; // 30 seconds

/**
 * Load Pyodide if not already loaded
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadPyodideInstance = async (): Promise<any> => {
    if (pyodide) {
        return pyodide;
    }

    if (isPyodideLoading && pyodideLoadPromise) {
        return pyodideLoadPromise;
    }

    isPyodideLoading = true;
    pyodideLoadPromise = new Promise((resolve, reject) => {
        // Add timeout to prevent infinite loading
        const timeoutId = setTimeout(() => {
            reject(
                new Error(
                    'Pyodide loading timed out after 30 seconds. Please refresh the page and try again.'
                )
            );
        }, PYODIDE_LOAD_TIMEOUT);

        (async () => {
            try {
                // Use a fixed version for now - you can make this dynamic later
                const pyodideVersion = '0.28.0';

                console.log(`Loading Pyodide version: ${pyodideVersion}`);

                // Dynamic import to avoid build issues
                const { loadPyodide } = await import('pyodide');

                pyodide = await loadPyodide({
                    indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
                    stdout: stdout,
                    stderr: stdout,
                    checkAPIVersion: true,
                });

                console.log('Pyodide loaded successfully');
                clearTimeout(timeoutId);

                if (pyodide) {
                    resolve(pyodide);
                } else {
                    reject(new Error('Pyodide failed to initialize'));
                }
            } catch (error) {
                console.error('Pyodide loading error:', error);
                clearTimeout(timeoutId);
                reject(error);
            }
        })();
    });

    return pyodideLoadPromise;
};

/**
 * Execute Python code using Pyodide
 */
export const executePythonWithPyodide = async (code: string): Promise<CodeExecutionResult> => {
    try {
        // Load Pyodide if not already loaded
        const pyodideInstance = await loadPyodideInstance();

        // Clear previous output
        consoleOutput = [];

        try {
            // Execute code using the working approach from the GitHub repo
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const dict = pyodideInstance.globals.get('dict') as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const globals = dict() as any;

            await pyodideInstance.loadPackagesFromImports(code);
            await pyodideInstance.runPythonAsync(code, { globals, locals: globals });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (globals as any).destroy();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (dict as any).destroy();
        } catch (executionError) {
            // Handle execution errors specifically
            console.error('[CodeEditor] Python execution error:', executionError);
            stdout(executionError instanceof Error ? executionError.stack : executionError);
        } finally {
            stdout(
                `\n[Editor (Pyodide: v${pyodideInstance.version}): ${new Date().toLocaleString('en-us')}]`
            );
        }

        // Combine output
        const output = consoleOutput.join('\n');
        const hasError = output.includes('Error:') || output.includes('Traceback');

        // Check if code contains input() function
        const needsInput = code.includes('input(');
        if (needsInput) {
            consoleOutput.push(
                '\nNote: Interactive input (input()) is not supported in this environment.'
            );
        }

        return {
            output: output.trim() || 'Code executed successfully (no output)',
            needsInput: false,
            hasError,
        };
    } catch (error) {
        console.error('[CodeEditor] Error loading or initializing Pyodide:', error);

        // Provide more specific error messages
        let errorMessage = 'Unknown error occurred while loading Pyodide.';

        if (error instanceof Error) {
            if (error.message.includes('timed out')) {
                errorMessage =
                    'Pyodide loading timed out. This might be due to slow internet connection or CDN issues. Please refresh the page and try again.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage =
                    'Failed to download Pyodide. Please check your internet connection and try again.';
            } else if (error.message.includes('pyodide')) {
                errorMessage = `Pyodide error: ${error.message}`;
            } else {
                errorMessage = `Loading error: ${error.message}`;
            }
        }

        return {
            output: `Pyodide Loading Error:\n${errorMessage}\n\nPlease try:\n1. Refresh the page\n2. Check your internet connection\n3. Try again in a few moments`,
            needsInput: false,
            hasError: true,
        };
    }
};

/**
 * Get the current code from the Monaco editor
 */
export const getCurrentCodeFromEditor = (editorRef: React.RefObject<unknown>): string => {
    if (
        editorRef.current &&
        typeof editorRef.current === 'object' &&
        'getValue' in editorRef.current
    ) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (editorRef.current as any).getValue() || '';
    }
    return '';
};

/**
 * Copy code to clipboard
 */
export const copyCodeToClipboard = (code: string): void => {
    navigator.clipboard.writeText(code);
};

/**
 * Download code as a file
 */
export const downloadCodeAsFile = (code: string, language: SupportedLanguage): void => {
    const extension = language === 'python' ? 'py' : 'js';
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `code.${extension}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Execute code using Pyodide for Python or fallback for other languages
 */
export const executeCode = async (
    code: string,
    language: SupportedLanguage
): Promise<CodeExecutionResult> => {
    if (!code.trim()) {
        return {
            output: 'No code to execute. Please write some code first.',
            needsInput: false,
        };
    }

    // Only support Python execution with Pyodide for now
    if (language === 'python') {
        return await executePythonWithPyodide(code);
    } else {
        return {
            output: `Language '${language}' is not supported yet. Only Python execution is available.`,
            needsInput: false,
        };
    }
};

/**
 * Handle user input submission during code execution
 */
export const handleUserInputSubmission = (
    userInput: string,
    language: SupportedLanguage,
    currentOutput: string
): string => {
    if (!userInput.trim()) {
        return currentOutput;
    }

    const trimmedInput = userInput.trim();
    let newOutput = currentOutput + trimmedInput + '\n';

    // Continue Python simulation after input
    if (language === 'python') {
        newOutput += `Hello, ${trimmedInput}! Welcome to coding!\nSum of numbers: 15\n\nNote: This is a Python simulation. For real Python execution, you would need a Python interpreter.`;
    }

    return newOutput;
};

/**
 * Setup keyboard shortcuts for the code editor
 */
export const setupKeyboardShortcuts = (
    onRunCode: () => void,
    isRunning: boolean,
    isEditable: boolean
): (() => void) => {
    const handleKeyDown = (event: KeyboardEvent) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
            event.preventDefault();
            if (!isRunning && isEditable) {
                onRunCode();
            }
        }
    };

    document.addEventListener('keydown', handleKeyDown);

    // Return cleanup function
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
    };
};

/**
 * Initialize language states based on code data
 */
export const initializeLanguageStates = (codeData?: CodeEditorData): AllLanguagesData => {
    // If we have allLanguagesData from the server, use that
    if (codeData?.allLanguagesData) {
        return {
            python: {
                code: codeData.allLanguagesData.python.code || DEFAULT_CODE.python,
                lastEdited: codeData.allLanguagesData.python.lastEdited,
            },
            javascript: {
                code: codeData.allLanguagesData.javascript.code || DEFAULT_CODE.javascript,
                lastEdited: codeData.allLanguagesData.javascript.lastEdited,
            },
        };
    }

    // Fallback to legacy single-language data structure
    const currentLanguage = codeData?.language as SupportedLanguage;
    const currentCode = codeData?.code;

    return {
        python: {
            code:
                currentLanguage === 'python'
                    ? currentCode || DEFAULT_CODE.python
                    : DEFAULT_CODE.python,
            lastEdited: currentLanguage === 'python' ? Date.now() : undefined,
        },
        javascript: {
            code: DEFAULT_CODE.javascript,
            lastEdited: undefined,
        },
    };
};

/**
 * Initialize current data state based on language states and code data
 */
export const initializeCurrentData = (
    codeData: CodeEditorData | undefined,
    languageStates: AllLanguagesData
): CodeEditorData => {
    const defaultLanguage = 'python';
    return {
        language: defaultLanguage,
        code: languageStates[defaultLanguage].code,
        theme: codeData?.theme || 'light',
        viewMode: codeData?.viewMode || 'edit',
    };
};
