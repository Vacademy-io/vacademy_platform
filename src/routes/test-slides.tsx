import { createFileRoute } from "@tanstack/react-router";
import { CodeEditorSlide } from "@/components/common/study-library/level-material/subject-material/module-material/chapter-material/slide-material/code-editor-slide";

export const Route = createFileRoute("/test-slides")({
  component: TestSlides,
});

// Test data for CodeEditorSlide
const testCodeEditorData = JSON.stringify({
  language: "python",
  // Legacy field for backward compatibility
  code: `# Welcome to Python Code Editor
print("Hello, World!")
numbers = [1, 2, 3, 4, 5]
total = sum(numbers)
print(f"Total: {total}")`,
  theme: "dark",
  viewMode: "edit",
  // New structure with both languages and timestamps
  allLanguagesData: {
    python: {
      code: `# Advanced Python Example
def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n-1) + fibonacci(n-2)

# Generate Fibonacci sequence
numbers = [fibonacci(i) for i in range(10)]
print("Fibonacci sequence:", numbers)

# Data structures
student_grades = {
    "Alice": 85,
    "Bob": 92,
    "Charlie": 78
}

for name, grade in student_grades.items():
    print(f"{name}: {grade}")`,
      lastEdited: Date.now() - 100000, // 100 seconds ago
    },
    javascript: {
      code: `// Advanced JavaScript Example
function fibonacci(n) {
    if (n <= 1) return n;
    return fibonacci(n-1) + fibonacci(n-2);
}

// Generate Fibonacci sequence
const numbers = Array.from({length: 10}, (_, i) => fibonacci(i));
console.log("Fibonacci sequence:", numbers);

// Modern JavaScript features
const studentGrades = new Map([
    ["Alice", 85],
    ["Bob", 92],
    ["Charlie", 78]
]);

studentGrades.forEach((grade, name) => {
    console.log(\`\${name}: \${grade}\`);
});

// Async/await example
async function fetchData() {
    console.log("Fetching data...");
    return "Data loaded successfully!";
}

fetchData().then(result => console.log(result));`,
      lastEdited: Date.now() - 50000, // 50 seconds ago
    },
  },
  // Legacy fields for backward compatibility
  readOnly: false,
  showLineNumbers: true,
  fontSize: 14,
  editorType: "codeEditor",
  timestamp: Date.now(),
});

export function TestSlides() {
  return (
    <div className="h-screen w-full p-4 bg-gray-50">
      <div className="h-full bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="p-4 border-b">
          <h1 className="text-xl font-bold">Code Editor Test</h1>
          <p className="text-gray-600">
            Testing CodeEditorSlide component independently
          </p>
        </div>
        <div className="h-[calc(100%-80px)]">
          <CodeEditorSlide published_data={testCodeEditorData} />
        </div>
      </div>
    </div>
  );
}
