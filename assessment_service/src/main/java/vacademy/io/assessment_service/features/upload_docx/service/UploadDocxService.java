package vacademy.io.assessment_service.features.upload_docx.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.assessment_service.features.evaluation.service.EvaluationJsonToMapConverter;
import vacademy.io.assessment_service.features.evaluation.service.QuestionEvaluationService;
import vacademy.io.assessment_service.features.question_core.dto.MCQEvaluationDTO;
import vacademy.io.assessment_service.features.question_core.dto.OptionDTO;
import vacademy.io.assessment_service.features.question_core.dto.QuestionDTO;
import vacademy.io.assessment_service.features.question_core.enums.QuestionAccessLevel;
import vacademy.io.assessment_service.features.question_core.enums.QuestionResponseTypes;
import vacademy.io.assessment_service.features.question_core.enums.QuestionTypes;
import vacademy.io.assessment_service.features.rich_text.dto.AssessmentRichTextDataDTO;
import vacademy.io.assessment_service.features.rich_text.enums.TextType;
import vacademy.io.common.exceptions.VacademyException;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class UploadDocxService {

    @Autowired
    QuestionEvaluationService questionEvaluationService;


    // Leading whitespace including non-breaking spaces, which Jsoup's html() emits as the "&nbsp;" entity.
    private static final String LEADING_WS = "(?:\\s|&nbsp;|\\u00A0)*";

    // Question marker: "(1.)" or "1.)" — leading parenthesis optional.
    private static final Pattern QUESTION_PATTERN = Pattern.compile("^\\s*\\(?\\d+\\.\\)\\s?.*");
    private static final String QUESTION_STRIP_REGEX = "^" + LEADING_WS + "\\(?\\d+\\.\\)\\s?";

    // Option marker: "(a.)", "(A.)", "(a)" or "(A)" — single letter, dot optional, any case.
    private static final Pattern OPTION_PATTERN = Pattern.compile("^\\s*\\([a-zA-Z]\\.?\\)\\s?.*");
    private static final String OPTION_STRIP_REGEX = "^" + LEADING_WS + "\\([a-zA-Z]\\.?\\)\\s?";

    // Tag marker: "Tag:" or "Tags:" (case-insensitive).
    private static final Pattern TAG_PATTERN = Pattern.compile("(?i)^\\s*tags?:.*");

    private boolean isQuestionLine(String text) {
        return QUESTION_PATTERN.matcher(text).matches();
    }

    private boolean isOptionLine(String text) {
        return OPTION_PATTERN.matcher(text).matches();
    }

    private boolean isAnswerLine(String text) {
        return text.startsWith("Ans:");
    }

    private boolean isExplanationLine(String text) {
        return text.startsWith("Exp:");
    }

    private boolean isTagLine(String text) {
        return TAG_PATTERN.matcher(text).matches();
    }

    // Any recognised marker that ends the free-form question stem.
    private boolean isBoundaryLine(String text) {
        return isOptionLine(text) || isTagLine(text) || isAnswerLine(text)
                || isExplanationLine(text) || isQuestionLine(text);
    }

    // Consume consecutive "Tag:/Tags:" paragraphs following position i, adding them to the question.
    // Subject tags may appear after the stem (e.g. "Tag: X" before options) or after the explanation
    // (canonical "Tags: a, b, c" placement) — this is called at every such boundary.
    private int consumeTagLines(Elements paragraphs, int i, QuestionDTO question) {
        while (i + 1 < paragraphs.size() && isTagLine(paragraphs.get(i + 1).text().trim())) {
            i++;
            addTagsFromLine(question, paragraphs.get(i).text().trim());
        }
        return i;
    }

    private void addTagsFromLine(QuestionDTO question, String lineText) {
        String content = lineText.replaceFirst("(?i)^\\s*tags?:\\s*", "").trim();
        for (String tag : content.split(",")) {
            String trimmedTag = tag.trim();
            if (!trimmedTag.isEmpty() && !question.getSubjectTags().contains(trimmedTag)) {
                question.getSubjectTags().add(trimmedTag);
            }
        }
    }

    public List<QuestionDTO> extractQuestions(String htmlContent, String questionIdentifier, String optionIdentifier, String answerIdentifier, String explanationIdentifier) {

        Document doc = Jsoup.parse(htmlContent);
        Elements paragraphs = doc.select("p");

        List<QuestionDTO> questions = new ArrayList<>();
        String explanationRegex = "Exp:";

        for (int i = 0; i < paragraphs.size(); i++) {
            String text = paragraphs.get(i).text().trim();

            // A question starts at "(1.)" or "1.)". Headers/blank lines never match and are skipped.
            if (!isQuestionLine(text)) {
                continue;
            }

            QuestionDTO question = new QuestionDTO(String.valueOf(extractQuestionNumber(text)));
            question.setSectionId("1");
            question.setText(new AssessmentRichTextDataDTO(null, TextType.HTML.name(), cleanHtmlTags(paragraphs.get(i).html(), QUESTION_STRIP_REGEX)));
            question.setAccessLevel(QuestionAccessLevel.PRIVATE.name());
            question.setQuestionResponseType(QuestionResponseTypes.OPTION.name());

            // Multi-line question stem: append paragraphs until any known marker is reached.
            while (i + 1 < paragraphs.size() && !isBoundaryLine(paragraphs.get(i + 1).text().trim())) {
                i++;
                question.appendQuestionHtml(cleanHtmlTags(paragraphs.get(i).outerHtml(), QUESTION_STRIP_REGEX));
            }

            // Tags may sit right after the stem, before the options (e.g. "Tag: Graph Theory").
            i = consumeTagLines(paragraphs, i, question);

            // Extract options (accepts "(a.)" and "(A)" styles); capture any stray tag line too.
            while (i + 1 < paragraphs.size()) {
                String nextText = paragraphs.get(i + 1).text().trim();
                if (isAnswerLine(nextText) || isExplanationLine(nextText) || isQuestionLine(nextText)) {
                    break;
                }
                i++;
                if (isOptionLine(nextText)) {
                    question.getOptions().add(new OptionDTO(String.valueOf(question.getOptions().size()),
                            new AssessmentRichTextDataDTO(null, TextType.HTML.name(), cleanHtmlTags(paragraphs.get(i).html(), OPTION_STRIP_REGEX))));
                } else if (isTagLine(nextText)) {
                    addTagsFromLine(question, nextText);
                }
            }

            // Extract answer (accepts "Ans: a", "Ans: A", "Ans: (B)").
            if (i + 1 < paragraphs.size() && isAnswerLine(paragraphs.get(i + 1).text().trim())) {
                i++;
                String contentAfterAns = paragraphs.get(i).text().trim().substring("Ans:".length()).trim();
                MCQEvaluationDTO mcqEvaluation = new MCQEvaluationDTO();
                mcqEvaluation.setType(QuestionTypes.MCQS.name());
                question.setQuestionType(QuestionTypes.MCQS.name());
                MCQEvaluationDTO.MCQData mcqData = new MCQEvaluationDTO.MCQData();

                Integer answerId = getAnswerId(contentAfterAns);
                if (answerId != null) {
                    try {
                        mcqData.setCorrectOptionIds(List.of(answerId.toString()));
                        mcqEvaluation.setData(mcqData);
                        question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(mcqEvaluation));
                        question.setParsedEvaluationObject(EvaluationJsonToMapConverter.convertJsonToMap(question.getAutoEvaluationJson()));
                    } catch (JsonProcessingException e) {
                        throw new VacademyException(e.getMessage());
                    }
                }
            }

            // Tags may also sit between the answer and the explanation.
            i = consumeTagLines(paragraphs, i, question);

            // Extract explanation.
            if (i + 1 < paragraphs.size() && isExplanationLine(paragraphs.get(i + 1).text().trim())) {
                i++;
                String filteredText = paragraphs.get(i).html().replaceAll(explanationRegex, "")
                        .replaceFirst("^" + LEADING_WS, "").trim();
                question.setExplanationText(new AssessmentRichTextDataDTO(null, TextType.HTML.name(), cleanHtmlTags(filteredText, explanationRegex)));
                while (i + 1 < paragraphs.size()
                        && !isTagLine(paragraphs.get(i + 1).text().trim())
                        && !isQuestionLine(paragraphs.get(i + 1).text().trim())) {
                    i++;
                    String filteredInternalText = paragraphs.get(i).outerHtml().replaceAll(explanationRegex, "").trim();
                    question.appendExplanationHtml(cleanHtmlTags(filteredInternalText, explanationRegex));
                }
            }

            // Tags at the end, after the explanation (canonical "Tags: a, b, c" placement).
            i = consumeTagLines(paragraphs, i, question);

            questions.add(question);
        }

        return questions;
    }

    private int extractQuestionNumber(String text) {
        // Define a regex pattern to match the question number formats
        String regex = "(\\d+)|(?:Q(\\d+))";
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(text);

        if (matcher.find()) {
            // If a match is found, return the first capturing group as an integer
            String numberStr = matcher.group(1); // This captures the number
            if (numberStr != null) {
                return Integer.parseInt(numberStr);
            }

            String qNumberStr = matcher.group(2); // This captures the Q number if present
            if (qNumberStr != null) {
                return Integer.parseInt(qNumberStr);
            }
        }

        // Return -1 or throw an exception if no valid number is found
        throw new IllegalArgumentException("Invalid question format: " + text);
    }

    private String cleanHtmlTags(String input, String regex) {
        if (input == null) return null;
        return input.replaceAll("(?i)</?(p|strong)>", "").replaceAll(regex, "");
    }

    private Integer getAnswerId(String text) {
        // Accept "a", "A", "(a)", "(B)", etc. — map the first answer letter to a zero-based option index.
        if (text == null) return null;
        for (int idx = 0; idx < text.length(); idx++) {
            char c = text.charAt(idx);
            if (Character.isLetter(c)) {
                int answerIndex = Character.toLowerCase(c) - 'a';
                return (answerIndex >= 0 && answerIndex < 26) ? answerIndex : null;
            }
        }
        return null;
    }


    public File convertMultiPartToFile(MultipartFile file) throws IOException {
        File convFile = File.createTempFile("uploaded", ".docx");
        try (FileOutputStream fos = new FileOutputStream(convFile)) {
            fos.write(file.getBytes());
        }
        return convFile;
    }


}


