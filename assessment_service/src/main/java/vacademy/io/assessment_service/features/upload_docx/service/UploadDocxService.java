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


    public List<QuestionDTO> extractQuestions(String htmlContent, String questionIdentifier, String optionIdentifier, String answerIdentifier, String explanationIdentifier) {

        Document doc = Jsoup.parse(htmlContent);
        Elements paragraphs = doc.select("p");

        List<QuestionDTO> questions = new ArrayList<>();

        String questionUpdateRegex = "^\\s*\\(\\d+\\.\\)\\s?";

        String questionRegex = "^\\s*\\(\\d+\\.\\)\\s?.*";

        String optionRegex = "^\\s*\\([a-zA-Z]\\.\\)\\s?.*";
        String optionUpdateRegex = "^\\s*\\([a-zA-Z]\\.\\)\\s?";
        String ansRegex = "Ans:";
        String explanationRegex = "Exp:";


        for (int i = 0; i < paragraphs.size(); i++) {
            Element paragraph = paragraphs.get(i);
            String text = paragraph.text().trim();
            boolean isValidQuestion = true;
            QuestionDTO question = null;

            // Detect questions using "startsWith" for "(number.)" format
            if (text.matches(questionRegex)) {

                int questionNumber = extractQuestionNumber(text);
                question = new QuestionDTO(String.valueOf(questionNumber));
                // Regex pattern to match
                question.setSectionId("1");
                question.setText(new AssessmentRichTextDataDTO(null, TextType.HTML.name(), cleanHtmlTags(paragraph.html(), questionUpdateRegex)));
                question.setAccessLevel(QuestionAccessLevel.PRIVATE.name());
                question.setQuestionResponseType(QuestionResponseTypes.OPTION.name());
                // Handle multi-line questions
                while (i + 1 < paragraphs.size() && !paragraphs.get(i + 1).text().startsWith("(a.)")) {
                    i++;
                    Element multiLineParagraph = paragraphs.get(i);
                    String multiLineText = multiLineParagraph.text().trim();

                    // Check for unexpected start patterns in multi-line questions
                    if (multiLineText.matches(questionRegex)) {
                        question.getErrors().add("Unexpected new question comes" + multiLineText);
                        isValidQuestion = false;
                        break;
                    } else if (multiLineText.startsWith("(b.)") || multiLineText.startsWith("(c.)") || multiLineText.startsWith("(d.)")) {
                        question.getErrors().add("Unexpected new question comes" + multiLineText);
                        isValidQuestion = false;
                        break;
                    } else if (multiLineText.startsWith("Ans:")) {
                        question.getErrors().add("Unexpected answer format in multi-line question:" + multiLineText);
                        isValidQuestion = false;
                        break;
                    } else if (multiLineText.startsWith("Exp:")) {
                        question.getErrors().add("Unexpected explanation format in multi-line question:" + multiLineText);
                        isValidQuestion = false;
                        break;
                    }

                    question.appendQuestionHtml(cleanHtmlTags(multiLineParagraph.outerHtml(), questionUpdateRegex));
                }

                if (!isValidQuestion) {
                    // Skip storing the invalid question and move to the next iteration
                    continue; // Moves to the next iteration of the 'for' loop
                }

                // Extract options
                while (i + 1 < paragraphs.size() && !paragraphs.get(i + 1).text().startsWith("Ans:") && !paragraphs.get(i + 1).text().startsWith("Exp:") && !paragraphs.get(i + 1).text().matches("^\\(\\d+\\.\\)\\s?.*")) {
                    i++;
                    Element optionParagraph = paragraphs.get(i);

                    if (optionParagraph.text().startsWith("(a.)") || optionParagraph.text().startsWith("(b.)") || optionParagraph.text().startsWith("(c.)") || optionParagraph.text().startsWith("(d.)")) {
                        question.getOptions().add(new OptionDTO(String.valueOf(question.getOptions().size()), new AssessmentRichTextDataDTO(null, TextType.HTML.name(), cleanHtmlTags(optionParagraph.html(), optionUpdateRegex))));
                    }
                }

                // Extract answer
                if (i + 1 < paragraphs.size() && paragraphs.get(i + 1).text().startsWith("Ans:")) {
                    i++;
                    String answerText = paragraphs.get(i).text();
                    String contentAfterAns = answerText.substring(ansRegex.length()).trim();
                    MCQEvaluationDTO mcqEvaluation = new MCQEvaluationDTO();
                    mcqEvaluation.setType(QuestionTypes.MCQS.name());
                    question.setQuestionType(QuestionTypes.MCQS.name());
                    MCQEvaluationDTO.MCQData mcqData = new MCQEvaluationDTO.MCQData();

                    try {
                        mcqData.setCorrectOptionIds(List.of(getAnswerId(contentAfterAns).toString()));
                        mcqEvaluation.setData(mcqData);

                        question.setAutoEvaluationJson(questionEvaluationService.setEvaluationJson(mcqEvaluation));
                        question.setParsedEvaluationObject(EvaluationJsonToMapConverter.convertJsonToMap(question.getAutoEvaluationJson()));
                    } catch (JsonProcessingException e) {
                        throw new VacademyException(e.getMessage());
                    }
                }

                // Extract explanation
                if (i + 1 < paragraphs.size() && paragraphs.get(i + 1).text().startsWith("Exp:")) {
                    i++;

                    String filteredText = paragraphs.get(i).html().replaceAll(explanationRegex, "").trim();
                    question.setExplanationText(new AssessmentRichTextDataDTO(null, TextType.HTML.name(), cleanHtmlTags(filteredText, explanationRegex)));
                    while (i + 1 < paragraphs.size() && !(paragraphs.get(i + 1).text().startsWith("(") && Character.isDigit(paragraphs.get(i + 1).text().charAt(1)))) {
                        i++;
                        String filteredInternalText = paragraphs.get(i).outerHtml().replaceAll(explanationRegex, "").trim();

                        question.appendExplanationHtml(cleanHtmlTags(filteredInternalText, explanationRegex));
                    }
                }
            }

            if (question != null)
                questions.add(question);
        }

        // Return combined data
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
        switch (text.toLowerCase()) {
            case "a":
                return 0;
            case "b":
                return 1;
            case "c":
                return 2;
            case "d":
                return 3;
            default:
                return null;
        }
    }


    public File convertMultiPartToFile(MultipartFile file) throws IOException {
        File convFile = File.createTempFile("uploaded", ".docx");
        try (FileOutputStream fos = new FileOutputStream(convFile)) {
            fos.write(file.getBytes());
        }
        return convFile;
    }


}


