package vacademy.io.media_service.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Utility class for HTML parsing and manipulation operations.
 * Consolidates duplicate HTML processing logic from various controllers and
 * services.
 */
public final class HtmlParsingUtils {

    private HtmlParsingUtils() {
        // Private constructor to prevent instantiation
    }

    /**
     * Removes extra slashes from img src attributes.
     * Converts escaped quote patterns to proper HTML quotes.
     *
     * @param input The HTML string with potentially escaped img src attributes
     * @return The cleaned HTML string with proper img src attributes
     */
    public static String removeExtraSlashes(String input) {
        if (input == null || input.isEmpty()) {
            return input;
        }

        // Regular expression to match <img src=\"...\"> and replace with <img
        // src="...">
        String regex = "<img src=\\\\\\\"(.*?)\\\\\\\">";
        String replacement = "<img src=\"$1\">";

        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(input);

        return matcher.replaceAll(replacement);
    }

    /**
     * Extracts the content between body tags from an HTML document.
     *
     * @param html The full HTML document string
     * @return The content between body tags, or the original string if no body tags
     *         found
     */
    public static String extractBody(String html) {
        if (html == null || html.isEmpty()) {
            return "";
        }

        // Regex to match the content between <body> and </body> tags
        Pattern pattern = Pattern.compile(
                "<body[^>]*>(.*?)</body>",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

        Matcher matcher = pattern.matcher(html);
        if (matcher.find()) {
            return matcher.group(1).trim();
        }

        return html;
    }

    /**
     * Cleans a string by:
     * 1. Removing backslashes that escape quotes
     * 2. Converting Unicode escape sequences like \u003c to corresponding
     * characters
     * 3. Handling common escape sequences like \n, \t, etc.
     *
     * @param input The string with escape sequences
     * @return The cleaned string with actual characters
     */
    public static String unescapeString(String input) {
        if (input == null) {
            return null;
        }

        StringBuilder result = new StringBuilder(input.length());
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);

            if (c == '\\' && i + 1 < input.length()) {
                char next = input.charAt(i + 1);

                switch (next) {
                    case '"':
                        result.append('"');
                        i++;
                        break;
                    case '\\':
                        result.append('\\');
                        i++;
                        break;
                    case 'n':
                        result.append('\n');
                        i++;
                        break;
                    case 't':
                        result.append('\t');
                        i++;
                        break;
                    case 'r':
                        result.append('\r');
                        i++;
                        break;
                    case 'u':
                        if (i + 5 < input.length()) {
                            try {
                                String hex = input.substring(i + 2, i + 6);
                                int codePoint = Integer.parseInt(hex, 16);
                                result.append((char) codePoint);
                                i += 5;
                            } catch (NumberFormatException e) {
                                result.append(c);
                            }
                        } else {
                            result.append(c);
                        }
                        break;
                    default:
                        result.append(c);
                        break;
                }
            } else {
                result.append(c);
            }
        }

        return result.toString();
    }

    /**
     * Checks if a file is an HTML file based on content type.
     *
     * @param contentType The content type of the file
     * @return true if the file is HTML, false otherwise
     */
    public static boolean isHtmlContentType(String contentType) {
        return "text/html".equals(contentType);
    }
}
