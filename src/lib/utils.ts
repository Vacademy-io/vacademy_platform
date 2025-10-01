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

/**
 * Sanitizes an HTML string by removing dangerous tags/attributes while allowing
 * a conservative set of formatting elements.
 *
 * Note: This is a lightweight, client-side sanitizer to protect common cases
 * such as inline event handlers, javascript: URLs, <script> and <style> tags.
 * If untrusted HTML is accepted broadly, consider using a mature sanitizer
 * library. This helper keeps our bundle small and covers our dashboard pins use.
 */
export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== "string") return "";

  const allowedTags = new Set([
    "b","i","em","strong","u","br","p","span","div","ul","ol","li",
    "blockquote","code","pre","a","img","h1","h2","h3","h4","h5","h6"
  ]);

  const allowedAttrsByTag: Record<string, Set<string>> = {
    a: new Set(["href", "title", "target", "rel"]),
    img: new Set(["src", "alt", "title"]),
    '*': new Set(["style", "class"]),
  };

  // Create a detached document to avoid executing anything
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${dirtyHtml}</div>`, "text/html");
  const container = doc.body.firstElementChild as HTMLElement | null;
  if (!container) return "";

  const isSafeUrl = (url: string | null) => {
    if (!url) return false;
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith("javascript:")) return false;
    if (trimmed.startsWith("data:")) return false;
    return true;
  };

  const sanitizeNode = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;

      // Remove script/style and unknown tags entirely
      const tagName = el.tagName.toLowerCase();
      if (tagName === "script" || tagName === "style") {
        el.remove();
        return;
      }
      if (!allowedTags.has(tagName)) {
        // Replace unknown element with its children (unwrap)
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        return;
      }

      // Remove dangerous attributes
      // Copy attr names first since we'll mutate during iteration
      const attrNames = Array.from(el.attributes).map(a => a.name);
      for (const attrName of attrNames) {
        const lower = attrName.toLowerCase();
        // Block inline event handlers and srcdoc
        if (lower.startsWith("on") || lower === "srcdoc") {
          el.removeAttribute(attrName);
          continue;
        }

        const allowedForTag = allowedAttrsByTag[tagName] || new Set<string>();
        const allowedForAll = allowedAttrsByTag['*'] || new Set<string>();
        if (!allowedForTag.has(lower) && !allowedForAll.has(lower)) {
          el.removeAttribute(attrName);
          continue;
        }

        // Extra validation for URL-bearing attributes
        if ((tagName === "a" && lower === "href") || (tagName === "img" && lower === "src")) {
          const val = el.getAttribute(attrName);
          if (!isSafeUrl(val)) {
            el.removeAttribute(attrName);
            continue;
          }
        }

        // For anchors, enforce safe rel when target=_blank
        if (tagName === "a" && lower === "target") {
          const target = el.getAttribute("target");
          if (target === "_blank") {
            const rel = el.getAttribute("rel") || "";
            if (!/\bnoopener\b/.test(rel) || !/\bnoreferrer\b/.test(rel)) {
              el.setAttribute("rel", "noopener noreferrer");
            }
          }
        }
      }

      // Recurse to children after sanitizing this node
      Array.from(el.childNodes).forEach(sanitizeNode);
    }
  };

  Array.from(container.childNodes).forEach(sanitizeNode);
  return container.innerHTML;
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
