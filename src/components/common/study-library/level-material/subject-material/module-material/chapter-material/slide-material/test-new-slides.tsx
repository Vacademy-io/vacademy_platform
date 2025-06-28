import { useState } from "react";
import { CodeEditorSlide } from "./code-editor-slide";
import { JupyterNotebookSlide } from "./jupyter-notebook-slide";
import { ScratchProjectSlide } from "./scratch-project-slide";
import { MyButton } from "@/components/design-system/button";

// Sample data for testing
const sampleCodeEditorData = JSON.stringify({
  language: "python",
  theme: "dark",
  code: '# Welcome to Python Code Editor\nprint("Hello, World!!")\n\n# Try some basic operations\nnumbers = [1, 2, 3, 4, 5]\nsum_numbers = sum(numbers)\nprint(f"Sum of numbers: {sum_numbers}")\n\n# Interactive input example\nname = input("Enter your name: ")\nprint(f"Hello, {name}! Welcome to coding!")',
  readOnly: false,
  showLineNumbers: true,
  fontSize: 14,
  editorType: "codeEditor",
  timestamp: 1751104385599,
  viewMode: "edit",
});

const sampleJupyterData = JSON.stringify({
  contentUrl:
    "https://vacademy-io.github.io/jupyter-code/notebooks/index.html?path=python.ipynb",
  projectName: "Jupyter Notebook",
  contentBranch: "main",
  notebookLocation: "root",
  activeTab: "notebook",
  editorType: "jupyterEditor",
  timestamp: 1751103890649,
});

const sampleScratchData = JSON.stringify({
  projectId: "1105113583",
  scratchUrl: "https://scratch.mit.edu/projects/1105113583/",
  embedType: "project",
  autoStart: false,
  hideControls: false,
  editorType: "scratchEditor",
  timestamp: 1751104369752,
  projectName: "Scratch Project 1105113583",
});

export const TestNewSlides = () => {
  const [activeSlide, setActiveSlide] = useState<
    "code" | "jupyter" | "scratch"
  >("code");

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      {/* Test Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-xl font-bold text-gray-900 mb-4">
          Test New Slide Types
        </h1>
        <div className="flex gap-2">
          <MyButton
            scale="medium"
            buttonType={activeSlide === "code" ? "primary" : "secondary"}
            onClick={() => setActiveSlide("code")}
          >
            Code Editor
          </MyButton>
          <MyButton
            scale="medium"
            buttonType={activeSlide === "jupyter" ? "primary" : "secondary"}
            onClick={() => setActiveSlide("jupyter")}
          >
            Jupyter Notebook
          </MyButton>
          <MyButton
            scale="medium"
            buttonType={activeSlide === "scratch" ? "primary" : "secondary"}
            onClick={() => setActiveSlide("scratch")}
          >
            Scratch Project
          </MyButton>
        </div>
      </div>

      {/* Slide Content */}
      <div className="flex-1 p-4">
        <div className="h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
          {activeSlide === "code" && (
            <CodeEditorSlide published_data={sampleCodeEditorData} />
          )}
          {activeSlide === "jupyter" && (
            <JupyterNotebookSlide published_data={sampleJupyterData} />
          )}
          {activeSlide === "scratch" && (
            <ScratchProjectSlide published_data={sampleScratchData} />
          )}
        </div>
      </div>
    </div>
  );
};
