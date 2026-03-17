package vacademy.io.media_service.util;

import java.util.Scanner;

public class MdToHtmlConverter {

    /**
     * Converts OCR-style Markdown with LaTeX to HTML.
     */
    public static String convertMarkdownToHtml(String markdownText) {
        if (markdownText == null) {
            return "";
        }

        StringBuilder html = new StringBuilder();

        // 1. HTML Header with MathJax Configuration
        // This configuration is CRITICAL. It tells MathJax to look for single '$'
        // for inline math, which is common in your OCR text but disabled by default.
        html.append("<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n");
        html.append("<meta charset=\"UTF-8\">\n");
        html.append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n");
        html.append("<title>Converted Document</title>\n");
        html.append("<style>\n");
        html.append(
                "  body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 20px auto; padding: 20px; color: #333; }\n");
        html.append(
                "  img { max-width: 100%; height: auto; display: block; margin: 20px auto; border: 1px solid #ddd; }\n");
        html.append("  h2 { border-bottom: 2px solid #eee; padding-bottom: 10px; margin-top: 30px; }\n");
        html.append("  .question { margin-bottom: 15px; }\n");
        html.append("  .math-block { overflow-x: auto; margin: 10px 0; }\n");
        html.append("</style>\n");

        // MathJax Script (Loads from CDN)
        html.append("<script>\n");
        html.append("  window.MathJax = {\n");
        html.append("    tex: {\n");
        html.append("      inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],\n");
        html.append("      displayMath: [['$$', '$$'], ['\\\\[', '\\\\\\]']]\n");
        html.append("    }\n");
        html.append("  };\n");
        html.append("</script>\n");
        html.append(
                "<script id=\"MathJax-script\" async src=\"https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js\"></script>\n");
        html.append("</head>\n<body>\n\n");

        // 2. Process Line by Line
        try (Scanner scanner = new Scanner(markdownText)) {
            while (scanner.hasNextLine()) {
                String line = scanner.nextLine().trim();

                if (line.isEmpty()) {
                    continue;
                }

                // Handle Headers (## Section A)
                if (line.startsWith("##")) {
                    String title = line.replaceFirst("^#+\\s*", "");
                    html.append("<h2>").append(escapeHtml(title)).append("</h2>\n");
                }
                // Handle Block Math ($$ ... $$) - Pass through directly for MathJax
                else if (line.startsWith("$$")) {
                    html.append("<div class=\"math-block\">").append(line).append("</div>\n");
                }
                // Handle Lists / Questions (1. (C) ...)
                else if (line.matches("^\\d+\\..*")) {
                    // Wrap numbered lines in a div or p
                    html.append("<div class=\"question\">").append(parseInlineFormatting(line)).append("</div>\n");
                }
                // Regular Text
                else {
                    html.append("<p>").append(parseInlineFormatting(line)).append("</p>\n");
                }
            }
        }

        html.append("\n</body>\n</html>");
        return html.toString();
    }

    /**
     * Basic helper to handle bold text, images, and simple inline conversions.
     * Note: We generally leave $ equations alone so MathJax can find them.
     */
    private static String parseInlineFormatting(String text) {
        // Convert images: ![alt](url) -> <img src="url" alt="alt" />
        // Regex handles ![...](...) structure
        text = text.replaceAll("!\\s?\\[(.*?)\\]\\((.*?)\\)", "<img src=\"$2\" alt=\"$1\" />");

        // Convert **bold** to <strong>
        text = text.replaceAll("\\*\\*(.*?)\\*\\*", "<strong>$1</strong>");

        // We do NOT escape < or > here aggressively because it might break
        // LaTeX (e.g., x < y). In a production environment, you would use a
        // robust library like CommonMark to safely handle this.
        return text;
    }

    // Helper to sanitize title text slightly
    private static String escapeHtml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;");
    }
}
