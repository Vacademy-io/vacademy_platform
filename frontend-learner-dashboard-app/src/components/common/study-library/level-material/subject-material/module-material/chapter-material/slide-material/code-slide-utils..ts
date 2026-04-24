import { CodeEditorData } from "./code-editor-slide";
import {
  DEFAULT_CODE_SAMPLES,
  SupportedLanguage,
} from "./constants/code-slide";

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
          "Pyodide loading timed out after 30 seconds. Please refresh the page and try again."
        )
      );
    }, PYODIDE_LOAD_TIMEOUT);

    (async () => {
      try {
        // Use a fixed version for now - you can make this dynamic later
        const pyodideVersion = "0.28.0";

        console.log(`Loading Pyodide version: ${pyodideVersion}`);

        // Dynamic import to avoid build issues
        const { loadPyodide } = await import("pyodide");

        pyodide = await loadPyodide({
          indexURL: `https://cdn.jsdelivr.net/pyodide/v${pyodideVersion}/full/`,
          stdout: stdout,
          stderr: stdout,
          checkAPIVersion: true,
        });

        console.log("Pyodide loaded successfully");
        clearTimeout(timeoutId);

        if (pyodide) {
          resolve(pyodide);
        } else {
          reject(new Error("Pyodide failed to initialize"));
        }
      } catch (error) {
        console.error("Pyodide loading error:", error);
        clearTimeout(timeoutId);
        reject(error);
      }
    })();
  });

  return pyodideLoadPromise;
};

/**
 * Execute Python code using Pyodide.
 *
 * Optional `stdin` feeds the Python program's input() calls. Without it,
 * Pyodide's `input()` raises `OSError: [Errno 29] I/O error` because the
 * browser has no stdin pipe. We install a line-pumping stdin callback via
 * `setStdin` before each run; when the lines are exhausted, we return null
 * so Python sees EOF (raises EOFError, which user code can handle).
 */
export const executePythonWithPyodide = async (
  code: string,
  stdin: string = ""
): Promise<CodeExecutionResult> => {
  try {
    // Load Pyodide if not already loaded
    const pyodideInstance = await loadPyodideInstance();

    // Clear previous output
    consoleOutput = [];

    // Install stdin for this run. Reset each call — lines are consumed in
    // order, null signals EOF. We trim trailing '\n' on each line because
    // Python's input() strips the terminator itself when reading from a
    // line-mode stdin.
    const stdinLines = stdin.length ? stdin.split("\n") : [];
    let stdinIdx = 0;
    try {
      pyodideInstance.setStdin({
         
        stdin: () =>
          stdinIdx < stdinLines.length ? (stdinLines[stdinIdx++] as string) : null,
        isatty: false,
      });
    } catch {
      // Older Pyodide builds may not expose setStdin; swallow so code
      // without input() still runs.
    }

    try {
      // Execute code using the working approach from the GitHub repo
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dict = pyodideInstance.globals.get("dict") as any;
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
      console.error("[CodeEditor] Python execution error:", executionError);
      stdout(
        executionError instanceof Error ? executionError.stack : executionError
      );
    } finally {
      // Only append the diagnostic footer for sandbox runs (no stdin). For
      // graded test-case runs the footer would pollute the stdout that we
      // compare against the expected output and cause false failures.
      if (!stdin.length) {
        stdout(
          `\n[Editor (Pyodide: v${
            pyodideInstance.version
          }): ${new Date().toLocaleString("en-us")}]`
        );
      }
    }

    // Combine output
    const output = consoleOutput.join("\n");
    const hasError = output.includes("Error:") || output.includes("Traceback");

    return {
      output: output.trim() || "Code executed successfully (no output)",
      needsInput: false,
      hasError,
    };
  } catch (error) {
    console.error("[CodeEditor] Error loading or initializing Pyodide:", error);

    // Provide more specific error messages
    let errorMessage = "Unknown error occurred while loading Pyodide.";

    if (error instanceof Error) {
      if (error.message.includes("timed out")) {
        errorMessage =
          "Pyodide loading timed out. This might be due to slow internet connection or CDN issues. Please refresh the page and try again.";
      } else if (error.message.includes("Failed to fetch")) {
        errorMessage =
          "Failed to download Pyodide. Please check your internet connection and try again.";
      } else if (error.message.includes("pyodide")) {
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
 * Copy code to clipboard
 */
export const copyCodeToClipboard = (code: string): void => {
  navigator.clipboard.writeText(code);
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
      output: "No code to execute. Please write some code first.",
      needsInput: false,
    };
  }

  // Only support Python execution with Pyodide for now
  if (language === "python") {
    return await executePythonWithPyodide(code);
  } else {
    return {
      output: `Language '${language}' is not supported yet. Only Python execution is available.`,
      needsInput: false,
    };
  }
};

// Utility function to create CodeEditor data structure for API calls
export const createCodeEditorApiData = (
  pythonCode: string = "",
  javascriptCode: string = "",
  currentLanguage: "python" | "javascript" = "python",
  options: Partial<CodeEditorData> = {}
): CodeEditorData => {
  const currentTime = Date.now();
  return {
    language: currentLanguage,
    theme: "dark",
    // Legacy field for backward compatibility
    code: currentLanguage === "python" ? pythonCode : javascriptCode,
    viewMode: "edit",
    // New structure with both languages and timestamps
    allLanguagesData: {
      python: {
        code: pythonCode || DEFAULT_CODE_SAMPLES.python,
        lastEdited: currentTime,
      },
      javascript: {
        code: javascriptCode || DEFAULT_CODE_SAMPLES.javascript,
        lastEdited: currentTime,
      },
    },
    // Legacy fields for backward compatibility
    readOnly: false,
    showLineNumbers: true,
    fontSize: 14,
    editorType: "codeEditor",
    timestamp: currentTime,
    ...options,
  };
};
