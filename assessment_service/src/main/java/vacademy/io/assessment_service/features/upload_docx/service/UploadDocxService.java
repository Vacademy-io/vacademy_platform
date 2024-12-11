package vacademy.io.assessment_service.features.upload_docx.service;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.assessment_service.features.upload_docx.dto.OptionResponseFromDocx;
import vacademy.io.assessment_service.features.upload_docx.dto.QuestionResponseFromDocx;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

@Service
public class UploadDocxService {

    public List<QuestionResponseFromDocx> extractQuestions(String htmlContent) {

        Document doc = Jsoup.parse(htmlContent);
        Elements paragraphs = doc.select("p");

        List<QuestionResponseFromDocx> questions = new ArrayList<>();

        String questionUpdateRegex = "^\\(\\d+\\.\\)\\s?";

        String questionRegex = "^\\(\\d+\\.\\)\\s?.*";
    ;
        String optionRegex = "^\\([a-zA-Z]\\.\\)\\s?.*";
        String optionUpdateRegex = "^\\([a-zA-Z]\\.\\)\\s?";
        String ansRegex = "Ans:";
        String explanationRegex = "Exp:";


        for (int i = 0; i < paragraphs.size(); i++) {
            Element paragraph = paragraphs.get(i);
            String text = paragraph.text().trim();
            boolean isValidQuestion = true;
            QuestionResponseFromDocx question = null;

            // Detect questions using "startsWith" for "(number.)" format
            if (text.matches(questionRegex)) {

                int questionNumber = extractQuestionNumber(text);
                question = new QuestionResponseFromDocx(questionNumber);
                 // Regex pattern to match

                question.setQuestionHtml(cleanHtmlTags(paragraph.html(), questionUpdateRegex));


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
                        question.getOptionsData().add(new OptionResponseFromDocx(question.getOptionsData().size(), cleanHtmlTags(optionParagraph.html(), optionUpdateRegex)));
                    }
                }

                // Extract answer
                if (i + 1 < paragraphs.size() && paragraphs.get(i + 1).text().startsWith("Ans:")) {
                    i++;
                    String answerText = paragraphs.get(i).text();
                    String contentAfterAns = answerText.substring(ansRegex.length()).trim();
                    question.setAnswerOptionIds(List.of(Objects.requireNonNull(getAnswerId(contentAfterAns)).toString()));
                }

                // Extract explanation
                if (i + 1 < paragraphs.size() && paragraphs.get(i + 1).text().startsWith("Exp:")) {
                    i++;

                    String filteredText = paragraphs.get(i).html().replaceAll(explanationRegex, "").trim();
                    question.setExplanationHtml(cleanHtmlTags(filteredText, explanationRegex));
                    while (i + 1 < paragraphs.size() && !(paragraphs.get(i + 1).text().startsWith("(") && Character.isDigit(paragraphs.get(i + 1).text().charAt(1)))) {
                        i++;
                        String filteredInternalText = paragraphs.get(i).outerHtml().replaceAll(explanationRegex, "").trim();

                        question.appendExplanationHtml(cleanHtmlTags(filteredInternalText, explanationRegex));
                    }
                }
            }

            if(question != null)
                questions.add(question);
        }

        // Return combined data
        return questions;
    }

    private int extractQuestionNumber(String text) {
        try {
            String number = text.substring(1, text.indexOf('.')).trim();
            return Integer.parseInt(number);
        } catch (NumberFormatException | IndexOutOfBoundsException e) {
            return -1;
        }
    }

    public File convertMultiPartToFile(MultipartFile file) throws IOException {
        File convFile = File.createTempFile("uploaded", ".docx");
        try (FileOutputStream fos = new FileOutputStream(convFile)) {
            fos.write(file.getBytes());
        }
        return convFile;
    }


    // clean html
    private String cleanHtmlTags(String input, String regex) {
        if (input == null) return null;
        return input.replaceAll("(?i)</?(p|strong)>", "").replaceAll(regex, "");
    }


    private Integer getAnswerId(String text) {
        if (text.startsWith("a")) {
            return 0;
        } else if (text.startsWith("b")) {
            return 1;
        } else if (text.startsWith("c")) {
            return 2;
        } else if (text.startsWith("d")) {
            return 3;
        }
        return null;
    }
}


