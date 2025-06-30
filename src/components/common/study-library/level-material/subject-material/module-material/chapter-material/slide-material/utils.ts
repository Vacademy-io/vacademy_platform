// export const getEpochTimeInMillis = (): number => {
//     return new Date().getTime(); // Returns epoch time in milliseconds
// };

export const getEpochTimeInMillis = (): number => {
  return Date.now();
};

export const getISTTimeISO = () => {
  return new Date(new Date().getTime() + 330 * 60000).toISOString();
};

export const getISTTime = () => {
  return new Date().toLocaleString("en-US", {
    timeZone: "Asia/Kolkata",
  });
};

import axios from "axios";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return (
    Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
  );
}

export const executeCodeWithPiston = async (code: string, language: string) => {
  const PISTONAPI = "https://emkc.org/api/v2/piston/execute";
  try {
    const response = await axios({
      method: "POST",
      url: PISTONAPI,
      data: {
        language: language,
        version: "*",
        files: [
          {
            content: code,
          },
        ],
      },
    });

    if (response.status !== 200) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result = await response.data;

    // Extract output from the response
    let output = "";
    let hasError = false;

    // Check for compilation stage (for languages that need it)
    if (result.compile) {
      console.log("[CodeEditor] Compile stage:", result.compile);
      if (result.compile.code !== 0) {
        // Compilation error
        output =
          "Compilation Error:\n" +
          (result.compile.stderr ||
            result.compile.output ||
            "Unknown compilation error");
        hasError = true;
      }
    }

    // Check for runtime stage
    if (result.run) {
      console.log("[CodeEditor] Run stage:", result.run);
      if (result.run.code !== 0) {
        // Runtime error
        output =
          "Runtime Error:\n" +
          (result.run.stderr || result.run.output || "Unknown runtime error");
        hasError = true;
      } else {
        // Successful execution
        output = result.run.output || result.run.stdout || "";
        if (result.run.stderr && result.run.stderr.trim()) {
          output += "\nWarnings:\n" + result.run.stderr;
        }
      }
    } else {
      output = "No execution result received";
      hasError = true;
    }

    // Check if code contains input() - this is a limitation for now
    const needsInput = code.includes("input(") && !hasError;
    if (needsInput) {
      output +=
        "\n\nNote: Interactive input is not supported in this online environment.";
    }

    return {
      output: output.trim() || "Code executed successfully (no output)",
      needsInput: false, // We don't support interactive input with Piston
      hasError,
    };
  } catch (error) {
    console.error("[CodeEditor] Error executing code with Piston:", error);

    // Fallback error message
    return {
      output: `Execution Error: ${
        error instanceof Error ? error.message : "Unknown error"
      }\n\nPlease check your code and try again.`,
      needsInput: false,
      hasError: true,
    };
  }
};
