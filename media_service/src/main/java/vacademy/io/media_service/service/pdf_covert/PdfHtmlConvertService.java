package vacademy.io.media_service.service.pdf_covert;

import org.springframework.stereotype.Component;

import java.util.regex.Matcher;
import java.util.regex.Pattern;


@Component
public class PdfHtmlConvertService {

    public String extractBody(String html) {
        if (html == null || html.isEmpty()) {
            return "";
        }

        // Regex to match the content between <body> and </body> tags
        Pattern pattern = Pattern.compile(
                "<body[^>]*>(.*?)</body>",
                Pattern.CASE_INSENSITIVE | Pattern.DOTALL // Handle case and multi-line content
        );

        Matcher matcher = pattern.matcher(html);
        if (matcher.find()) {
            // Extract the content (group 1) between the tags
            return matcher.group(1).trim(); // Trim to remove leading/trailing whitespace
        } else {
            return html;
        }
    }
}
