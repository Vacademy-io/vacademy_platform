package vacademy.io.admin_core_service.features.learner_tracking.util;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns stored rich text into the plain text an LLM should actually read.
 *
 * <p>Question and option content is authored as HTML with KaTeX spans. Handing that to a
 * model verbatim costs a large multiple of the tokens the words are worth and buries the
 * question in markup. Mirrors what assessment_service already does for its own LLM
 * payload (HtmlBuilderService.stripHtmlTags), kept deliberately small here: decode
 * entities, keep the LaTeX source, drop the tags.
 */
public final class RichTextForAI {

    private static final Pattern DATA_LATEX = Pattern.compile("<[^>]*data-latex=\"([^\"]*)\"[^>]*>(?:(?!</span>).)*</span>",
            Pattern.DOTALL);
    private static final Pattern TEX_ANNOTATION = Pattern
            .compile("<annotation[^>]*encoding=\"application/x-tex\"[^>]*>([^<]*)</annotation>");
    private static final Pattern TAG = Pattern.compile("<[^>]+>");
    private static final Pattern WHITESPACE = Pattern.compile("\\s+");

    /**
     * Markup that arrived entity-encoded, e.g. {@code &lt;span data-latex=...&gt;}. Only
     * that case is decoded before tags are stripped - decoding unconditionally would turn
     * an inequality written as {@code a &lt; b} into an opening tag and delete the rest of
     * the sentence with it.
     */
    private static final Pattern ENCODED_MARKUP = Pattern.compile(
            "&lt;/|&lt;(span|p|div|br|strong|em|b|i|u|img|table|tr|td|li|ul|ol|h[1-6]|annotation)\\b",
            Pattern.CASE_INSENSITIVE);

    private RichTextForAI() {
    }

    public static String toPlainText(String content) {
        if (content == null || content.isEmpty()) {
            return "";
        }

        String text = content;
        if (ENCODED_MARKUP.matcher(text).find()) {
            text = text.replace("&lt;", "<").replace("&gt;", ">");
        }

        if (text.indexOf('<') >= 0) {
            // Replace rendered maths with its LaTeX source before the tags go, so an
            // equation survives as something readable rather than as KaTeX debris.
            text = replaceAll(DATA_LATEX, text);
            text = replaceAll(TEX_ANNOTATION, text);

            text = text
                    .replaceAll("(?i)<br\\s*/?>", " ")
                    .replaceAll("(?i)</(p|div|li|tr|h[1-6])>", " ");
            text = TAG.matcher(text).replaceAll("");
        }

        // Entities decode last: by now there is no markup left for a decoded `<` to be
        // mistaken for.
        text = text
                .replace("&lt;", "<")
                .replace("&gt;", ">")
                .replace("&quot;", "\"")
                .replace("&#39;", "'")
                .replace("&nbsp;", " ")
                .replace("&amp;", "&");

        return WHITESPACE.matcher(text).replaceAll(" ").trim();
    }

    private static String replaceAll(Pattern pattern, String input) {
        Matcher matcher = pattern.matcher(input);
        StringBuilder out = new StringBuilder();
        while (matcher.find()) {
            String latex = matcher.group(1) == null ? "" : matcher.group(1).trim();
            matcher.appendReplacement(out, Matcher.quoteReplacement(latex.isEmpty() ? "" : " " + latex + " "));
        }
        matcher.appendTail(out);
        return out.toString();
    }
}
