package vacademy.io.media_service.service;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class HtmlSpanCleaner {

    /**
     * Removes newline characters (\n) only from within <span...>...</span> tags.
     * It handles spans with attributes.
     *
     * @param htmlInput The input string containing HTML-like content.
     * @return A new string with newlines removed from inside span tags.
     */
    public static String removeNewlinesInsideSpans(String htmlInput) {
        if (htmlInput == null || htmlInput.isEmpty()) {
            return htmlInput;
        }

        // Regex explanation:
        // (<span[^>]*>) : Group 1: Matches the opening <span> tag, including any attributes.
        //               [^>]* matches any character except '>' zero or more times.
        // (.*?)        : Group 2: Matches any character (including newline due to DOTALL)
        //               lazily (non-greedy) between the tags. This is the content.
        // (</span>)    : Group 3: Matches the closing </span> tag.
        // Pattern.DOTALL allows '.' to match newline characters.
        Pattern pattern = Pattern.compile("(<span[^>]*>)(.*?)(</span>)", Pattern.DOTALL);
        Matcher matcher = pattern.matcher(htmlInput);

        StringBuffer resultBuffer = new StringBuffer();

        // Find each match and process it
        while (matcher.find()) {
            String openingTag = matcher.group(1); // The <span...> part
            String content = matcher.group(2);    // The content inside the span
            String closingTag = matcher.group(3); // The </span> part

            // Remove newlines specifically from the content
            String cleanedContent = content.replace("\n", "");

            // Append the modified segment (original tags + cleaned content)
            // We use Matcher.quoteReplacement to handle any special characters
            // like '$' or '\' within the tags/content, although simple
            // concatenation is often fine if you're sure they don't exist.
            // For this specific case, simple concatenation is safe and clearer.
            // matcher.appendReplacement(resultBuffer,
            //        Matcher.quoteReplacement(openingTag) +
            //        Matcher.quoteReplacement(cleanedContent) +
            //        Matcher.quoteReplacement(closingTag));
            matcher.appendReplacement(resultBuffer, openingTag + cleanedContent + closingTag);
        }

        // Append the rest of the string after the last match
        matcher.appendTail(resultBuffer);

        return resultBuffer.toString();
    }

    // Example Usage
}