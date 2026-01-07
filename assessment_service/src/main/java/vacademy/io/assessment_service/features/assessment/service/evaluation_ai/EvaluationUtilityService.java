package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Utility service for evaluation-related helper methods
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class EvaluationUtilityService {

        private final ObjectMapper objectMapper;
        private final QuestionAssessmentSectionMappingRepository questionAssessmentSectionMappingRepository;

        /**
         * Extract body content from HTML
         */
        public String extractBody(String html) {
                if (!StringUtils.hasText(html))
                        return "";
                Pattern pattern = Pattern.compile("<body[^>]*>(.*?)</body>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
                Matcher matcher = pattern.matcher(html);
                return matcher.find() ? matcher.group(1).trim() : html;
        }

        /**
         * Process markdown content by extracting image information
         */
        public String processMarkdownContent(String markdown) {
                if (!StringUtils.hasText(markdown))
                        return "";

                // Process images in markdown - extract URLs and descriptions
                StringBuilder processedContent = new StringBuilder();
                String[] lines = markdown.split("\n");

                for (String line : lines) {
                        // Handle image markdown syntax ![alt](url)
                        if (line.contains("![")) {
                                Pattern imagePattern = Pattern.compile("!\\[([^\\]]*)\\]\\(([^)]+)\\)");
                                Matcher imageMatcher = imagePattern.matcher(line);

                                StringBuffer replaced = new StringBuffer();
                                while (imageMatcher.find()) {
                                        String altText = imageMatcher.group(1);
                                        String imageUrl = imageMatcher.group(2);

                                        String replacement = String.format("[IMAGE: %s - %s]",
                                                        altText.isEmpty() ? "diagram" : altText,
                                                        imageUrl);
                                        imageMatcher.appendReplacement(replaced, Matcher.quoteReplacement(replacement));
                                }
                                imageMatcher.appendTail(replaced);
                                processedContent.append(replaced).append("\n");
                        } else {
                                processedContent.append(line).append("\n");
                        }
                }

                return processedContent.toString().trim();
        }

        /**
         * Clean HTML content using Jsoup
         */
        public String cleanHtml(String html) {
                if (html == null)
                        return "";
                try {
                        return Jsoup.parse(html).text();
                } catch (Exception e) {
                        return html;
                }
        }

        /**
         * Extract LaTeX from KaTeX HTML to reduce token usage while preserving math
         * notation.
         * Falls back to original HTML if extraction fails.
         */
        public String extractLatexFromKatex(String html) {
                if (html == null || html.isEmpty()) {
                        return html;
                }

                try {
                        // Pattern to find KaTeX annotation tags containing original LaTeX
                        Pattern annotationPattern = Pattern.compile(
                                        "<annotation encoding=\"application/x-tex\">(.*?)</annotation>",
                                        Pattern.DOTALL);

                        Matcher matcher = annotationPattern.matcher(html);
                        StringBuffer result = new StringBuffer();
                        int replacementCount = 0;

                        // Replace each KaTeX block with its LaTeX source
                        while (matcher.find()) {
                                String latex = matcher.group(1).trim();
                                // Wrap in $ delimiters for inline math
                                String replacement = "\\$" + Matcher.quoteReplacement(latex) + "\\$";
                                matcher.appendReplacement(result, replacement);
                                replacementCount++;
                        }
                        matcher.appendTail(result);

                        String processed = result.toString();

                        // Remove KaTeX display wrapper spans (now redundant)
                        processed = processed.replaceAll("<span class=\"katex-display\">.*?(?=\\\\$)\\\\$", "\\$");
                        processed = processed.replaceAll("\\$</span>", "\\$");

                        // Remove remaining KaTeX HTML rendering blocks
                        processed = processed.replaceAll(
                                        "<span class=\"katex\">.*?</span>\\s*(?=\\$|[^<])",
                                        "");

                        // Clean remaining HTML tags
                        processed = Jsoup.parse(processed).text();

                        if (replacementCount > 0) {
                                log.info("Extracted {} LaTeX expressions from KaTeX HTML. " +
                                                "Original length: {}, Processed length: {}, Token reduction: ~{}%",
                                                replacementCount, html.length(), processed.length(),
                                                (int) ((1.0 - (double) processed.length() / html.length()) * 100));
                        }

                        return processed;

                } catch (Exception e) {
                        log.warn("Failed to extract LaTeX from KaTeX HTML, using original content. Error: {}",
                                        e.getMessage());
                        // Fallback: return cleaned HTML without LaTeX extraction
                        return cleanHtml(html);
                }
        }

        /**
         * Extract question text from Question entity
         */
        public String extractQuestionText(Question question) {
                if (question.getTextData() != null && question.getTextData().getContent() != null) {
                        String content = question.getTextData().getContent();
                        // Extract LaTeX from KaTeX HTML to reduce token usage
                        return extractLatexFromKatex(content);
                }
                if (question.getParentRichText() != null && question.getParentRichText().getContent() != null) {
                        String content = question.getParentRichText().getContent();
                        // Extract LaTeX from KaTeX HTML to reduce token usage
                        return extractLatexFromKatex(content);
                }
                return "";
        }

        /**
         * Extract fileId from attemptData JSON
         */
        public String extractFileId(String attemptData) {
                try {
                        JsonNode root = objectMapper.readTree(attemptData);
                        return root.path("fileId").asText(null);
                } catch (Exception e) {
                        log.error("Failed to extract fileId from attemptData: {}", e.getMessage());
                        return null;
                }
        }

        /**
         * Extraction of max marks using findByQuestionIdAndSectionId - same pattern
         * as getQuestionsOfSection
         */
        public double extractMaxMarksFromSectionMapping(QuestionWiseMarks marks, Question question) {
                try {
                        String sectionId = marks.getSectionId();
                        if (sectionId == null || sectionId.isEmpty()) {
                                log.warn("No sectionId for Q: {}", question.getId());
                                return 10.0;
                        }

                        // FAST: Uses indexed query on (questionId, sectionId)
                        Optional<QuestionAssessmentSectionMapping> mappingOpt = questionAssessmentSectionMappingRepository
                                        .findByQuestionIdAndSectionId(
                                                        question.getId(), sectionId);

                        if (mappingOpt.isEmpty()) {
                                log.warn("No mapping for Q: {}, S: {}", question.getId(), sectionId);
                                return 10.0;
                        }

                        String markingJson = mappingOpt.get().getMarkingJson();
                        if (markingJson == null || markingJson.isEmpty()) {
                                log.warn("No markingJson for Q: {}", question.getId());
                                return 10.0;
                        }

                        // Parse marking JSON
                        JsonNode jsonNode = objectMapper.readTree(markingJson);
                        double totalMark = jsonNode.path("data").path("totalMark").asDouble(10.0);

                        log.info("Extracted {} marks from DB for Q: {}", totalMark, question.getId());
                        return totalMark;
                } catch (Exception e) {
                        log.error("Error extracting marks for Q: {}, using 10.0", question.getId(), e);
                        return 10.0;
                }
        }
}
