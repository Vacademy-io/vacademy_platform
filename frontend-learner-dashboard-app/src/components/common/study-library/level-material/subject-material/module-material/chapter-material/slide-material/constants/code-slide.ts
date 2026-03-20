// Default code samples for each language
export const DEFAULT_CODE_SAMPLES = {
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

export const SUPPORTED_LANGUAGES = ["python"] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
