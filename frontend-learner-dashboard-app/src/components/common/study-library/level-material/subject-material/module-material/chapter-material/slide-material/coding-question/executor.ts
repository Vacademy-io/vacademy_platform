import { LANGUAGE_REGISTRY } from "./language-registry";
import { executeOnJudge0, judge0OutputToConsoleText } from "./judge0-client";
import { LangId } from "./types";
// Reuse the already-loaded Pyodide instance from the existing learner utils so
// we don't double-download Pyodide. The exported helper handles all Pyodide
// lifecycle + stdout capture.
import { executePythonWithPyodide } from "../code-slide-utils.";

export interface RunResult {
  stdout: string;
  stderr: string;
  output: string; // human-friendly combined string for the console pane
  hasError: boolean;
  timeMs?: number;
  memoryKb?: number;
}

export interface RunOptions {
  stdin?: string;
  cpuSeconds?: number;
  memoryKb?: number;
}

function runJsInBrowser(code: string, stdin: string): RunResult {
  const logs: string[] = [];
  const errors: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  let hasError = false;
  try {
    console.log = (...args: unknown[]) => {
      logs.push(
        args
          .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
          .join(" "),
      );
    };
    console.error = (...args: unknown[]) => {
      hasError = true;
      const msg = args
        .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
        .join(" ");
      errors.push(msg);
      logs.push("ERROR: " + msg);
    };
    const stdinLines = stdin.split("\n");
    let stdinIdx = 0;
    const readline = () => stdinLines[stdinIdx++] ?? "";
    const fn = new Function("readline", '"use strict";\n' + code);
    const result = fn(readline);
    if (result !== undefined) logs.push(String(result));
  } catch (err) {
    hasError = true;
    const msg = "Error: " + (err instanceof Error ? err.message : String(err));
    errors.push(msg);
    logs.push(msg);
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
  const stdout = logs.join("\n");
  return {
    stdout,
    stderr: errors.join("\n"),
    output: stdout || "(no output)",
    hasError,
  };
}

/**
 * Dispatches code execution by language: pyodide / browser eval / Judge0.
 * Pure stdout/stderr/error model so the question-mode grader can compare
 * against expected stdout.
 */
export async function runCode(
  code: string,
  language: LangId,
  options: RunOptions = {},
): Promise<RunResult> {
  if (!code.trim()) {
    return {
      stdout: "",
      stderr: "",
      output: "No code to execute. Please write some code first.",
      hasError: true,
    };
  }

  const def = LANGUAGE_REGISTRY[language] ?? LANGUAGE_REGISTRY.python;

  if (def.executor === "pyodide") {
    // Existing helper returns { output, needsInput, hasError }. Treat output as
    // combined stdout — Pyodide already merges stdout and exception traces.
    // Pass stdin so input()-using solutions work for graded test cases.
    const r = await executePythonWithPyodide(code, options.stdin);
    return {
      stdout: r.output,
      stderr: r.hasError ? r.output : "",
      output: r.output,
      hasError: !!r.hasError,
    };
  }

  if (def.executor === "browser") {
    return runJsInBrowser(code, options.stdin ?? "");
  }

  try {
    const j = await executeOnJudge0({
      sourceCode: code,
      language,
      stdin: options.stdin,
      cpuSeconds: options.cpuSeconds,
      memoryKb: options.memoryKb,
    });
    const hasError = !!j.compileOutput || !!j.stderr || j.statusId >= 6;
    return {
      stdout: j.stdout,
      stderr: j.stderr || j.compileOutput,
      output: judge0OutputToConsoleText(j),
      hasError,
      timeMs: j.timeMs,
      memoryKb: j.memoryKb,
    };
  } catch (err) {
    const msg =
      "Judge0 error: " +
      (err instanceof Error ? err.message : String(err)) +
      "\n(ce.judge0.com is rate-limited; if you hit a 429 wait a bit and retry.)";
    return {
      stdout: "",
      stderr: msg,
      output: msg,
      hasError: true,
    };
  }
}

/**
 * Run a single test case and produce a pass/fail verdict by comparing trimmed
 * stdout to the expected output. Stderr is informational only.
 */
export async function runTestCase(
  code: string,
  language: LangId,
  testStdin: string,
  expectedStdout: string,
  options: RunOptions = {},
): Promise<{
  passed: boolean;
  stdout: string;
  stderr: string;
  timeMs?: number;
  memoryKb?: number;
  error?: string;
}> {
  try {
    const r = await runCode(code, language, { ...options, stdin: testStdin });
    const actual = (r.stdout ?? "").trim();
    const expected = (expectedStdout ?? "").trim();
    return {
      passed: !r.hasError && actual === expected,
      stdout: r.stdout,
      stderr: r.stderr,
      timeMs: r.timeMs,
      memoryKb: r.memoryKb,
    };
  } catch (err) {
    return {
      passed: false,
      stdout: "",
      stderr: "",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
