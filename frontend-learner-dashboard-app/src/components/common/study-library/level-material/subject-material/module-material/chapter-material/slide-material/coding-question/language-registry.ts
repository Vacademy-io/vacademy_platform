import { LangId } from "./types";

export interface LanguageDef {
  id: LangId;
  label: string;
  monacoLang: string;
  fileExt: string;
  executor: "pyodide" | "browser" | "judge0";
  judge0Id: number;
  starter: string;
}

export const LANGUAGE_REGISTRY: Record<LangId, LanguageDef> = {
  python: {
    id: "python",
    label: "Python 3",
    monacoLang: "python",
    fileExt: "py",
    executor: "pyodide",
    judge0Id: 71,
    starter: '# Write your Python code here\nprint("Hello, World!")\n',
  },
  javascript: {
    id: "javascript",
    label: "JavaScript (Node)",
    monacoLang: "javascript",
    fileExt: "js",
    executor: "browser",
    judge0Id: 63,
    starter:
      '// Write your JavaScript code here\nconsole.log("Hello, World!");\n',
  },
  c: {
    id: "c",
    label: "C (GCC 9.2)",
    monacoLang: "c",
    fileExt: "c",
    executor: "judge0",
    judge0Id: 50,
    starter:
      '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, World!\\n");\n    return 0;\n}\n',
  },
  cpp: {
    id: "cpp",
    label: "C++ (GCC 9.2)",
    monacoLang: "cpp",
    fileExt: "cpp",
    executor: "judge0",
    judge0Id: 54,
    starter:
      '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n',
  },
  java: {
    id: "java",
    label: "Java (OpenJDK 13)",
    monacoLang: "java",
    fileExt: "java",
    executor: "judge0",
    judge0Id: 62,
    starter:
      'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n',
  },
  go: {
    id: "go",
    label: "Go (1.13)",
    monacoLang: "go",
    fileExt: "go",
    executor: "judge0",
    judge0Id: 60,
    starter:
      'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n',
  },
};

export const ALL_LANG_IDS: readonly LangId[] = Object.keys(
  LANGUAGE_REGISTRY,
) as LangId[];

export function getLanguageDef(id: string | undefined | null): LanguageDef {
  if (id && id in LANGUAGE_REGISTRY) return LANGUAGE_REGISTRY[id as LangId];
  return LANGUAGE_REGISTRY.python;
}
