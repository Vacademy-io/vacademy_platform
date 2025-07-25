import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isNullOrEmptyOrUndefined<T>(
  value: T | null | undefined
): value is null | undefined {
  return (
    value === null ||
    value === undefined ||
    (typeof value === "string" && value === "")
  );
}

export function convertCapitalToTitleCase(str: string) {
  // Split the text into words
  const words = str?.split(" ");

  // Capitalize the first letter of each word and convert the rest to lowercase
  const titleCaseWords = words?.map(
    (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  );

  // Join the words back into a string
  const titleCaseText = titleCaseWords?.join(" ");

  return titleCaseText;
}

export function parseHtmlToString(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || doc.body.innerText || "";
}

export const processHtmlString = (htmlString: string) => {
  // Create a temporary div to parse the HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = htmlString;
  // Array to store processed content
  const processedContent: Array<{ type: "text" | "image"; content: string }> =
    [];
  // Iterate through child nodes
  tempDiv.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      // Process text nodes
      const trimmedText = node.textContent?.trim();
      if (trimmedText) {
        processedContent.push({
          type: "text",
          content: trimmedText,
        });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      // Process image nodes
      if (element.tagName.toLowerCase() === "img") {
        const src = element.getAttribute("src");
        if (src) {
          processedContent.push({
            type: "image",
            content: src,
          });
        }
      } else {
        // Process other elements' text content
        const text = element.textContent?.trim();
        if (text) {
          processedContent.push({
            type: "text",
            content: text,
          });
        }
      }
    }
  });
  return processedContent;
};

/**
 * Converts a string to title case
 * @param text - The string to convert to title case
 * @returns The string in title case format
 */
export function toTitleCase(text: string): string {
  if (!text) return text;
  
  return text
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Handle special cases like "level 1", "level 2", etc.
      if (word.match(/^level\s*\d+$/i)) {
        return word.replace(/^level\s*(\d+)$/i, 'Level $1');
      }
      // Handle other common patterns
      if (word.match(/^\d+$/)) {
        return word; // Keep numbers as is
      }
      // Capitalize first letter of each word
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}
