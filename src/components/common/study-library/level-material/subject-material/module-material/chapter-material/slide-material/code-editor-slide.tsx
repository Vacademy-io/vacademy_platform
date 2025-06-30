/* eslint-disable */
/**
 * CodeEditorSlide Component
 *
 * This component now supports storing code for multiple languages (Python and JavaScript)
 * in both the data and published_data JSON strings for API calls.
 *
 * New Data Structure Format:
 * {
 *   language: "python" | "javascript",
 *   theme: "dark" | "light",
 *   code: string, // Legacy field for backward compatibility
 *   viewMode: "edit" | "view",
 *   allLanguagesData: {
 *     python: {
 *       code: string,
 *       lastEdited: number // timestamp
 *     },
 *     javascript: {
 *       code: string,
 *       lastEdited: number // timestamp
 *     }
 *   },
 *   // Legacy fields for backward compatibility
 *   readOnly?: boolean,
 *   showLineNumbers?: boolean,
 *   fontSize?: number,
 *   editorType?: "codeEditor",
 *   timestamp?: number
 * }
 *
 * Both languages' code will be sent in update and publish API calls.
 * Use createCodeEditorApiData() utility function for external API calls.
 */
import { useState, useEffect } from "react";
import {
  Code,
  Play,
  Moon,
  Sun,
  Copy,
  Download,
  Settings,
  ChevronDown,
} from "lucide-react";

import Editor from "@monaco-editor/react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { executeCodeWithPiston } from "./utils";

interface CodeEditorData {
  language: string;
  theme: "dark" | "light";
  // Legacy field for backward compatibility
  code: string;
  viewMode: "edit" | "view";
  // New structure to store all languages' data with timestamps
  allLanguagesData: {
    python: {
      code: string;
      lastEdited: number;
    };
    javascript: {
      code: string;
      lastEdited: number;
    };
  };
  // Legacy fields for backward compatibility
  readOnly?: boolean;
  showLineNumbers?: boolean;
  fontSize?: number;
  editorType?: "codeEditor";
  timestamp?: number;
}

interface CodeEditorSlideProps {
  published_data: string;
}

// Default code samples for each language
const DEFAULT_CODE_SAMPLES = {
  python: `# Python Example
def greet(name):
    print(f"Hello, {name}!")
    return f"Welcome to Python programming!"

# Variables and data types
numbers = [1, 2, 3, 4, 5]
total = sum(numbers)

print("Sum of numbers:", total)
greet("World")

# Input example
user_input = input("Enter your name: ")
print(f"Nice to meet you, {user_input}!")`,

  javascript: `// JavaScript Example
function greet(name) {
    console.log(\`Hello, \${name}!\`);
    return \`Welcome to JavaScript programming!\`;
}

// Variables and data types
const numbers = [1, 2, 3, 4, 5];
const total = numbers.reduce((sum, num) => sum + num, 0);

console.log("Sum of numbers:", total);
greet("World");

// DOM interaction example
document.addEventListener('DOMContentLoaded', function() {
    console.log("Page loaded successfully!");
});`,
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

export const CodeEditorSlide: React.FC<CodeEditorSlideProps> = ({
  published_data,
}) => {
  const [editorState, setEditorState] = useState({
    currentLanguage: "python" as keyof typeof DEFAULT_CODE_SAMPLES,
    theme: "dark" as "dark" | "light",
    readOnly: false,
    viewMode: "edit" as "edit" | "view",
    codeSamples: {
      python: "",
      javascript: "",
    },
  });

  const [output, setOutput] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "output">("editor");
  const [waitingForInput, setWaitingForInput] = useState(false);

  // Initialize from published_data with proper priority
  useEffect(() => {
    if (!published_data) {
      setEditorState({
        currentLanguage: "python",
        theme: "dark",
        readOnly: false,
        viewMode: "edit",
        codeSamples: {
          python: DEFAULT_CODE_SAMPLES.python,
          javascript: DEFAULT_CODE_SAMPLES.javascript,
        },
      });
      return;
    }

    try {
      const data = JSON.parse(published_data) as CodeEditorData;

      const initialLanguage =
        (data.language as keyof typeof DEFAULT_CODE_SAMPLES) || "python";

      // Priority logic for code content:
      // 1. New allLanguagesData structure (if exists and has content)
      // 2. Legacy code field (for backward compatibility)
      // 3. Default samples
      const getCodeForLanguage = (
        lang: keyof typeof DEFAULT_CODE_SAMPLES,
        allLanguagesData?: {
          python: { code: string; lastEdited: number };
          javascript: { code: string; lastEdited: number };
        },
        legacyCode?: string,
        isCurrentLanguage?: boolean
      ) => {
        // First priority: New allLanguagesData structure
        if (
          allLanguagesData &&
          allLanguagesData[lang] &&
          allLanguagesData[lang].code &&
          allLanguagesData[lang].code.trim()
        ) {
          return allLanguagesData[lang].code;
        }

        // Second priority: Legacy code field (only for current language)
        if (isCurrentLanguage && legacyCode && legacyCode.trim()) {
          return legacyCode;
        }

        // Fallback: Default samples
        return DEFAULT_CODE_SAMPLES[lang];
      };

      const newState = {
        currentLanguage: initialLanguage,
        theme: data.theme || "dark",
        readOnly: data.readOnly || false,
        viewMode: data.viewMode || "edit",
        codeSamples: {
          python: getCodeForLanguage(
            "python",
            data.allLanguagesData,
            data.code,
            initialLanguage === "python"
          ),
          javascript: getCodeForLanguage(
            "javascript",
            data.allLanguagesData,
            data.code,
            initialLanguage === "javascript"
          ),
        },
      };

      setEditorState(newState);
    } catch (error) {
      console.error("[CodeEditor] Error parsing published_data:", error);
      // Fallback to defaults only if parsing completely fails
      setEditorState({
        currentLanguage: "python",
        theme: "dark",
        readOnly: false,
        viewMode: "edit",
        codeSamples: {
          python: DEFAULT_CODE_SAMPLES.python,
          javascript: DEFAULT_CODE_SAMPLES.javascript,
        },
      });
    }
  }, [published_data]);

  // Get current code based on selected language
  const getCurrentCode = () => {
    return editorState.codeSamples[editorState.currentLanguage];
  };

  // Execute code using Piston API for real code execution

  const runCode = () => {
    const currentCode = getCurrentCode();

    if (!currentCode.trim()) {
      setOutput("No code to execute. Please write some code first.");
      setActiveTab("output");
      return;
    }

    setIsRunning(true);
    setActiveTab("output");
    setOutput("Running code...");

    // Execute code with Piston API for real execution
    executeCodeWithPiston(currentCode, editorState.currentLanguage)
      .then(({ output, needsInput }) => {
        setOutput(output);
        setWaitingForInput(needsInput);
        setIsRunning(false);
      })
      .catch((error) => {
        console.error("[CodeEditor] Failed to execute code:", error);
        setOutput(`Execution failed: ${error.message || "Unknown error"}`);
        setWaitingForInput(false);
        setIsRunning(false);
      });
  };

  const copyCode = () => {
    navigator.clipboard.writeText(getCurrentCode());
  };

  const downloadCode = () => {
    const code = getCurrentCode();
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code.${
      editorState.currentLanguage === "python" ? "py" : "js"
    }`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleThemeChange = () => {
    setEditorState((prev) => ({
      ...prev,
      theme: prev.theme === "dark" ? "light" : "dark",
    }));
  };

  const handleLanguageChange = (
    language: keyof typeof DEFAULT_CODE_SAMPLES
  ) => {
    setEditorState((prev) => ({
      ...prev,
      currentLanguage: language,
      // If switching to a language that has no code (empty), populate with default
      codeSamples: {
        ...prev.codeSamples,
        [language]:
          prev.codeSamples[language] || DEFAULT_CODE_SAMPLES[language],
      },
    }));
    // Clear output when switching languages
    setOutput("");
    setWaitingForInput(false);
  };

  const handleCodeChange = (value: string | undefined) => {
    if (editorState.readOnly || editorState.viewMode === "view") return;

    const newCode = value || "";
    setEditorState((prev) => ({
      ...prev,
      codeSamples: {
        ...prev.codeSamples,
        [prev.currentLanguage]: newCode,
      },
    }));
  };

  const handleInputSubmit = () => {
    if (inputValue.trim()) {
      setOutput(
        (prev) =>
          prev +
          `${inputValue}\nProcessing input...\nNice to meet you, ${inputValue}!\n`
      );
      setInputValue("");
      setWaitingForInput(false);
    }
  };

  const handleEditorDidMount = (editor: any, monaco: any) => {
    // Add Ctrl+Enter shortcut to run code
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      runCode();
    });
  };

  const isEditable = !editorState.readOnly;
  const currentCode = getCurrentCode();

  // Generate complete data structure for API calls (update/publish)
  const generateApiData = (): CodeEditorData => {
    const currentTime = Date.now();
    return {
      language: editorState.currentLanguage,
      theme: editorState.theme,
      // Legacy field for backward compatibility
      code: editorState.codeSamples[editorState.currentLanguage],
      viewMode: editorState.viewMode,
      // New structure with both languages and timestamps
      allLanguagesData: {
        python: {
          code: editorState.codeSamples.python,
          lastEdited: currentTime,
        },
        javascript: {
          code: editorState.codeSamples.javascript,
          lastEdited: currentTime,
        },
      },
      // Legacy fields for backward compatibility
      readOnly: editorState.readOnly,
      showLineNumbers: true,
      fontSize: 14,
      editorType: "codeEditor",
      timestamp: currentTime,
    };
  };

  // Get JSON string for API calls
  const getApiDataJsonString = (): string => {
    return JSON.stringify(generateApiData());
  };

  // Console log for debugging API data structure (remove in production)
  useEffect(() => {
    console.log(
      "[CodeEditor] API Data Structure for update/publish:",
      generateApiData()
    );
    console.log("[CodeEditor] JSON String for API:", getApiDataJsonString());
  }, [editorState]);

  // Example usage for API calls (commented out as this is a learner app)
  /*
  // Example 1: Using the internal generateApiData function
  const updateSlideDataInternal = async () => {
    const apiData = getApiDataJsonString();
    
    // For update API call
    const updateResponse = await authenticatedAxiosInstance.put(
      `${UPDATE_SLIDE_URL}`,
      {
        data: apiData,
        published_data: apiData, // Send both languages in both fields
      },
      {
        params: {
          slideId: activeItem?.id,
          chapterId: chapterId,
        },
      }
    );

    return updateResponse.data;
  };

  // Example 2: Using the exported createCodeEditorApiData utility function
  const updateSlideDataExternal = async (pythonCode: string, jsCode: string) => {
    const apiDataObject = createCodeEditorApiData(
      pythonCode,
      jsCode,
      "python", // current language
      { theme: "dark", viewMode: "edit" } // additional options
    );
    const apiDataString = JSON.stringify(apiDataObject);
    
    // For update API call
    const updateResponse = await authenticatedAxiosInstance.put(
      `${UPDATE_SLIDE_URL}`,
      {
        data: apiDataString,
        published_data: apiDataString, // Both languages included
      },
      {
        params: {
          slideId: activeItem?.id,
          chapterId: chapterId,
        },
      }
    );

    // For publish API call
    const publishResponse = await authenticatedAxiosInstance.post(
      `${PUBLISH_SLIDE_URL}`,
      {
        data: apiDataString,
        published_data: apiDataString, // Both languages included
      },
      {
        params: {
          slideId: activeItem?.id,
          chapterId: chapterId,
        },
      }
    );

    return { updateResponse: updateResponse.data, publishResponse: publishResponse.data };
  };
  */

  return (
    <div className="h-full p-1">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex flex-col items-center justify-between gap-2 lg:flex-row">
            <div className="flex items-center gap-2">
              <Code className="size-5" />
              <span className="text-lg font-semibold">Code Editor</span>
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs font-normal text-gray-600">
                {editorState.viewMode === "edit" ? "Edit Mode" : "View Mode"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                onClick={runCode}
                disabled={isRunning || !isEditable}
                size="sm"
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Play className="mr-1 size-4" />
                {isRunning ? "Running..." : "Run"}
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="mr-1 size-4" />
                    Settings
                    <ChevronDown className="ml-1 size-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem
                    onClick={() => handleLanguageChange("python")}
                    className={
                      editorState.currentLanguage === "python"
                        ? "bg-accent"
                        : ""
                    }
                  >
                    <span>Python</span>
                    {editorState.currentLanguage === "python" && (
                      <span className="ml-auto">✓</span>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => handleLanguageChange("javascript")}
                    className={
                      editorState.currentLanguage === "javascript"
                        ? "bg-accent"
                        : ""
                    }
                  >
                    <span>JavaScript</span>
                    {editorState.currentLanguage === "javascript" && (
                      <span className="ml-auto">✓</span>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleThemeChange}
                    disabled={!isEditable}
                  >
                    {editorState.theme === "light" ? (
                      <>
                        <Moon className="mr-2 size-4" />
                        Switch to Dark Theme
                      </>
                    ) : (
                      <>
                        <Sun className="mr-2 size-4" />
                        Switch to Light Theme
                      </>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={copyCode}>
                    <Copy className="mr-2 size-4" />
                    Copy Code
                  </DropdownMenuItem>

                  <DropdownMenuItem onClick={downloadCode}>
                    <Download className="mr-2 size-4" />
                    Download Code
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs
            value={activeTab}
            onValueChange={(value) =>
              setActiveTab(value as "output" | "editor")
            }
            className="h-full"
          >
            <div className="flex items-center justify-between px-6 pb-4">
              <TabsList className="grid grid-cols-2">
                <TabsTrigger value="editor">Code Editor</TabsTrigger>
                <TabsTrigger value="output" className="relative">
                  Output
                  {output && !isRunning && (
                    <span className="ml-1 inline-flex size-2 rounded-full bg-green-500"></span>
                  )}
                </TabsTrigger>
              </TabsList>
              <div className="hidden text-sm text-gray-500 lg:inline-block">
                Press Ctrl+Enter to run code
              </div>
            </div>

            <TabsContent value="editor" className="m-0 h-[500px]">
              <div className="h-full border-t">
                <Editor
                  height="100%"
                  language={editorState.currentLanguage}
                  value={currentCode}
                  theme={editorState.theme === "dark" ? "vs-dark" : "light"}
                  onChange={handleCodeChange}
                  onMount={handleEditorDidMount}
                  options={{
                    readOnly: !isEditable || editorState.viewMode === "view",
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    fontSize: 14,
                    lineNumbers: "on",
                    roundedSelection: false,
                    scrollbar: {
                      verticalScrollbarSize: 8,
                      horizontalScrollbarSize: 8,
                    },
                    padding: { top: 16 },
                  }}
                />
              </div>
            </TabsContent>

            <TabsContent value="output" className="m-0 h-[500px]">
              <div className="flex h-full flex-col border-t">
                <div className="flex-1 overflow-auto bg-gray-900 p-4 font-mono text-sm text-green-400">
                  <pre className="whitespace-pre-wrap">
                    {output || 'Click "Run Code" to see output here...'}
                  </pre>
                  {waitingForInput && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-yellow-400">{">"}</span>
                      <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            handleInputSubmit();
                          }
                        }}
                        className="flex-1 border-none bg-transparent text-green-400 outline-none"
                        placeholder="Type your input and press Enter..."
                        autoFocus
                      />
                    </div>
                  )}
                </div>
                {waitingForInput && (
                  <div className="border-t border-gray-700 bg-gray-800 p-2">
                    <div className="flex gap-2">
                      <button
                        onClick={handleInputSubmit}
                        className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700"
                      >
                        Submit
                      </button>
                      <button
                        onClick={() => {
                          setWaitingForInput(false);
                          setInputValue("");
                        }}
                        className="rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
