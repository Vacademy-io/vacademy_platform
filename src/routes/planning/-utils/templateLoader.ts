/**
 * Extracts the inner HTML content from the full HTML document
 * Removes DOCTYPE, head, body tags to get just the content
 * @param html - The full HTML document string
 * @returns Inner HTML content suitable for the editor
 */
export function unwrapContentFromHTML(html: string): string {
  if (!html) return "";

  // Simple regex to extract content between <body> and </body>
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch && bodyMatch[1]) {
    return bodyMatch[1].trim();
  }

  // Fallback: if no body tag found, return as is
  if (html.includes("<!DOCTYPE html>") || html.includes("<html")) {
    // Try to parse with DOMParser to be safe
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    return doc.body.innerHTML;
  }

  return html;
}

/**
 * Wraps the editor content in the full HTML document structure
 * @param content - The inner HTML content (from editor)
 * @returns Full HTML document string
 */
export function wrapContentInHTML(content: string): string {
  // If content already has doctype/html tags, return as is
  if (content.includes("<!DOCTYPE html>") || content.includes("<html")) {
    return content;
  }

  const HTML_TEMPLATE_HEAD = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Planner Table</title>
    <style>
        /* Scoped styles to ensure it renders correctly inside a React div */
        .planner-table-container {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            width: 100%;
            background: white;
            color: #1f2937;
        }
        /* Additional planning template styles */
    </style>
</head>
<body>
`;

  const HTML_TEMPLATE_FOOTER = `
</body>
</html>`;

  return `${HTML_TEMPLATE_HEAD}${content}${HTML_TEMPLATE_FOOTER}`;
}
