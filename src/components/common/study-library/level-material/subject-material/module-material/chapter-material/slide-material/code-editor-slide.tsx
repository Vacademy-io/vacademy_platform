/* eslint-disable */
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

interface CodeEditorData {
  language: string;
  theme: "dark" | "light";
  code: string;
  readOnly: boolean;
  showLineNumbers: boolean;
  fontSize: number;
  editorType: "codeEditor";
  timestamp: number;
  viewMode: "edit" | "view";
}

interface CodeEditorSlideProps {
  published_data: string;
}

export const CodeEditorSlide: React.FC<CodeEditorSlideProps> = ({
  published_data,
}) => {
  const [code, setCode] = useState("");
  const [output, setOutput] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<"editor" | "output">("editor");
  const [currentData, setCurrentData] = useState<CodeEditorData | null>(null);
  const [waitingForInput, setWaitingForInput] = useState(false);

  useEffect(() => {
    try {
      const data = JSON.parse(published_data) as CodeEditorData;
      setCurrentData(data);
      setCode(data.code);
    } catch (error) {
      console.error("Failed to parse code editor data:", error);
    }
  }, [published_data]);

  const runCode = () => {
    if (!currentData) return;

    setIsRunning(true);
    setActiveTab("output");
    setOutput("Running code...");

    // Simulate code execution
    setTimeout(() => {
      if (currentData.language === "python") {
        setOutput("Hello, World!!\nSum of numbers: 15\n");
        // Simulate waiting for input
        setWaitingForInput(true);
      } else if (currentData.language === "javascript") {
        setOutput("Hello, World!!\n");
      } else {
        setOutput(`Executed ${currentData.language} code successfully!`);
      }
      setIsRunning(false);
    }, 1500);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(code);
  };

  const downloadCode = () => {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code.${currentData?.language === "python" ? "py" : "js"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleThemeChange = () => {
    if (!currentData) return;
    setCurrentData({
      ...currentData,
      theme: currentData.theme === "dark" ? "light" : "dark",
    });
  };

  const handleLanguageChange = (language: string) => {
    if (!currentData) return;
    setCurrentData({
      ...currentData,
      language,
    });
  };

  const handleCodeChange = (value: string | undefined) => {
    if (currentData?.readOnly || currentData?.viewMode === "view") return;
    setCode(value || "");
    if (currentData) {
      setCurrentData({
        ...currentData,
        code: value || "",
      });
    }
  };

  const handleInputSubmit = () => {
    if (inputValue.trim()) {
      setOutput((prev) => prev + `\n> ${inputValue}\nProcessing input...\n`);
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

  if (!currentData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-500">Loading code editor...</div>
      </div>
    );
  }

  const isEditable = !currentData.readOnly;

  return (
    <div className="h-full p-1">
      <Card className="h-full">
        <CardHeader className="pb-2">
          <div className="flex flex-col items-center justify-between gap-2 lg:flex-row">
            <div className="flex items-center gap-2">
              <Code className="size-5" />
              <span className="text-lg font-semibold">Code Editor</span>
              <span className="ml-2 rounded-full bg-gray-100 px-2 py-1 text-xs font-normal text-gray-600">
                {currentData.viewMode === "edit" ? "Edit Mode" : "View Mode"}
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
                    disabled={!isEditable || currentData.viewMode === "view"}
                    className={
                      currentData.language === "python" ? "bg-accent" : ""
                    }
                  >
                    <span>Python</span>
                    {currentData.language === "python" && (
                      <span className="ml-auto">✓</span>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => handleLanguageChange("javascript")}
                    disabled={!isEditable || currentData.viewMode === "view"}
                    className={
                      currentData.language === "javascript" ? "bg-accent" : ""
                    }
                  >
                    <span>JavaScript</span>
                    {currentData.language === "javascript" && (
                      <span className="ml-auto">✓</span>
                    )}
                  </DropdownMenuItem>

                  <DropdownMenuSeparator />

                  <DropdownMenuItem
                    onClick={handleThemeChange}
                    disabled={!isEditable}
                  >
                    {currentData.theme === "light" ? (
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
                  language={currentData.language}
                  value={currentData.code}
                  theme={currentData.theme === "dark" ? "vs-dark" : "light"}
                  onChange={handleCodeChange}
                  onMount={handleEditorDidMount}
                  options={{
                    readOnly: !isEditable || currentData.viewMode === "view",
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
