package vacademy.io.media_service.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.batik.transcoder.TranscoderException;
import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.wmf.tosvg.WMFTranscoder;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.zwobble.mammoth.DocumentConverter;
import org.zwobble.mammoth.Result;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.media_service.dto.*;
import vacademy.io.media_service.enums.NumericQuestionTypes;
import vacademy.io.media_service.enums.QuestionResponseType;
import vacademy.io.media_service.enums.QuestionTypes;
import vacademy.io.media_service.service.EvaluationJsonToMapConverter;
import vacademy.io.media_service.service.HtmlImageConverter;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.zwobble.mammoth.internal.util.Base64Encoding.streamToBase64;
import static vacademy.io.media_service.controller.ai.QuestionGeneratorController.extractBody;


@RestController
@RequestMapping("/media-service/convert")
public class DocxToHtmlController {

    @Autowired
    HtmlImageConverter htmlImageConverter;
    @Autowired
    private ObjectMapper objectMapper;

    public static String convertBase64WmfImagesToSvg(String htmlContent)
            throws TranscoderException, IOException {

        // Pattern to match WMF images in base64 format
        Pattern wmfPattern = Pattern.compile("data:image/x-wmf;base64,([^\"]+)");

        // Create a matcher to find all occurrences of WMF images
        Matcher matcher = wmfPattern.matcher(htmlContent);

        // Create a string buffer to store the modified HTML content
        StringBuffer result = new StringBuffer();

        // Iterate over all matches and replace WMF images with SVG images
        while (matcher.find()) {
            // Extract the base64-encoded WMF image
            String base64Wmf = matcher.group(1);

            // Convert the WMF image to an SVG image
            String base64Svg = convertBase64WmfToBase64Svg(base64Wmf);

            // Replace the WMF image with the SVG image
            matcher.appendReplacement(result, "data:image/svg+xml;base64," + base64Svg);
        }

        // Append the remaining HTML content
        matcher.appendTail(result);

        // Return the modified HTML content
        return result.toString();
    }

    public static String convertBase64WmfToBase64Svg(String base64Wmf) throws TranscoderException, IOException {
        byte[] wmfData = Base64.getDecoder().decode(base64Wmf);
        WMFTranscoder wmfTranscoder = new WMFTranscoder();
        ByteArrayInputStream wmfStream = new ByteArrayInputStream(wmfData);
        ByteArrayOutputStream svgStream = new ByteArrayOutputStream();
        TranscoderInput wmfInput = new TranscoderInput(wmfStream);
        TranscoderOutput svgOutput = new TranscoderOutput(svgStream);
        wmfTranscoder.transcode(wmfInput, svgOutput); // Encode the SVG byte array to Base64
        return Base64.getEncoder().encodeToString(svgStream.toByteArray());
    }

    public static int[] extractQuestionNumbers(String text) {
        // Updated regex: Matches both (1C1.) and (1 C1.)
        String regex = "\\((\\d+)\\s*C(\\d+)\\.\\)";
        Pattern pattern = Pattern.compile(regex);
        Matcher matcher = pattern.matcher(text);

        if (matcher.find()) {
            // Extract the numbers before and after 'C'
            int beforeC = Integer.parseInt(matcher.group(1)); // Number before 'C'
            int afterC = Integer.parseInt(matcher.group(2));  // Number after 'C'
            return new int[]{beforeC, afterC};
        }

        // Return -1 if no match is found or throw an error
        throw new IllegalArgumentException("Invalid question format: " + text);
    }

    @GetMapping("/test")
    public String index() {
        return "Hello World";
    }

    @PostMapping("/base64-to-network-images")
    public ResponseEntity<byte[]> htmlImageProcessing(@RequestParam("file") MultipartFile file) {
        try {
            String html = new String(file.getBytes(), StandardCharsets.UTF_8);
            String htmlBody = extractBody(html);
            String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);
            byte[] fileContent = networkHtml.getBytes(StandardCharsets.UTF_8);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentDisposition(ContentDisposition.attachment().filename("processed.html").build());
            headers.setContentType(MediaType.APPLICATION_OCTET_STREAM); // Ensures download

            return new ResponseEntity<>(fileContent, headers, HttpStatus.OK);
        } catch (IOException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    @PostMapping("/doc-to-html")
    public List<QuestionDTO> docToHtml(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "questionIdentifier", required = false) String questionIdentifier,
            @RequestParam(value = "optionIdentifier", required = false) String optionIdentifier,
            @RequestParam(value = "answerIdentifier", required = false) String answerIdentifier,
            @RequestParam(value = "explanationIdentifier", required = false) String explanationIdentifier,
            @RequestParam(value = "numericQuestionIdentifier", required = false) String numericQuestionIdentifier) {

        questionIdentifier = "(\\d+\\.|\\d+|Q\\d+)";
        optionIdentifier = "\\([a-zA-Z]\\.)";
        answerIdentifier = "Ans";
        explanationIdentifier = "Exp";

        // Check if the uploaded file is HTML
        if (isHtmlFile(file)) {
            return extractQuestionsFromHtml(file, questionIdentifier, optionIdentifier, answerIdentifier, explanationIdentifier);
        }

        // Process DOCX file to HTML
        String html = convertDocxToHtml(file);
        try {

            String htmlBody = extractBody(html);
            String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);
            return extractQuestions(networkHtml, questionIdentifier, optionIdentifier, answerIdentifier, explanationIdentifier);

        } catch (IOException e) {
            throw new VacademyException(e.getMessage());
        }
    }

    private String convertDocxToHtml(MultipartFile file) {
        DocumentConverter converter = createDocumentConverter();
        String html = "";

        try {
            File tempFile = convertMultiPartToFile(file);
            Result<String> result = converter.convertToHtml(tempFile);
            html = convertBase64WmfImagesToSvg(result.getValue());
            tempFile.delete(); // Clean up temporary file
        } catch (Exception e) {
            e.printStackTrace();
            throw new VacademyException("Failed to process question settings " + e.getMessage());
        }

        return html;
    }

    private DocumentConverter createDocumentConverter() {
        return new DocumentConverter()
                .imageConverter(image -> {
                    String base64;
                    String src;
                    if ("image/x-wmf".equals(image.getContentType()) || "image/x-emf".equals(image.getContentType())) {
                        try {
                            base64 = convertWmfToSvg(image.getInputStream().readAllBytes());
                            src = "data:image/svg+xml;base64," + base64;
                        } catch (TranscoderException e) {
                            throw new RuntimeException(e);
                        }
                    } else {
                        base64 = streamToBase64(image::getInputStream);
                        src = "data:" + image.getContentType() + ";base64," + base64;
                    }
                    Map<String, String> attributes = new HashMap<>();
                    attributes.put("src", src);
                    return attributes;
                });
    }

    private String convertWmfToSvg(byte[] wmfData) throws TranscoderException, IOException {
        // Convert WMF to SVG
        WMFTranscoder wmfTranscoder = new WMFTranscoder();
        ByteArrayInputStream wmfStream = new ByteArrayInputStream(wmfData);
        ByteArrayOutputStream svgStream = new ByteArrayOutputStream();
        TranscoderInput wmfInput = new TranscoderInput(wmfStream);
        TranscoderOutput svgOutput = new TranscoderOutput(svgStream);
        wmfTranscoder.transcode(wmfInput, svgOutput);
        return Base64.getEncoder().encodeToString(svgStream.toByteArray());
    }

    private boolean isHtmlFile(MultipartFile file) {
        return "text/html".equals(file.getContentType());
    }

    private List<QuestionDTO> extractQuestionsFromHtml(MultipartFile file, String questionIdentifier, String optionIdentifier, String answerIdentifier, String explanationIdentifier) {
        try {
            String html = new String(file.getBytes(), StandardCharsets.UTF_8);
            String htmlBody = extractBody(html);
            String networkHtml = htmlImageConverter.convertBase64ToUrls(htmlBody);
            return extractQuestions(networkHtml, questionIdentifier, optionIdentifier, answerIdentifier, explanationIdentifier);
        } catch (IOException e) {
            e.printStackTrace();
            throw new RuntimeException("Error reading HTML file", e);
        }
    }

    public List<QuestionDTO> extractQuestions(String htmlContent, String questionIdentifier, String optionIdentifier, String answerIdentifier, String explanationIdentifier) {

        Document doc = Jsoup.parse(htmlContent);
        Elements paragraphs = doc.select("p");

        List<QuestionDTO> questions = new ArrayList<>();

        String questionUpdateRegex = "\\(\\d+\\.\\)";
        String comprehensionQuestionUpdateRegex = "\\(C\\d+\\.\\)";
        String subQuestionUpdateRegex = "\\(\\d+\\sC\\d+\\.\\)";


        String questionRegex = "^\\s*\\(\\d+\\.\\)\\s?.*";
        String comprehensionQuestionRegex = "^\\s*\\(C\\d+\\.\\)\\s?.*";
        String subQuestionRegexWithSpace = "^\\s*\\(\\d+\\sC\\d+\\.\\)\\s?.*"; // (1 C1.)
        String subQuestionRegex = "^\\s*\\(\\d+C\\d+\\.\\)\\s?.*"; // (1C1.)
        String optionRegex = "^\\s*\\([a-zA-Z]\\.\\)\\s?.*";
        String optionUpdateRegex = "\\([a-zA-Z]\\.\\)";
        String ansRegex = "Ans:";
        String explanationRegex = "Exp:";

        AssessmentRichTextDataDTO comprehensionRichText = null;


        for (int i = 0; i < paragraphs.size(); i++) {
            Element paragraph = paragraphs.get(i);
            String text = paragraph.text().trim();
            boolean isValidQuestion = true;
            QuestionDTO question = null;

            // Detect questions using "startsWith" for "(C${number}.)" format
            if (text.matches(comprehensionQuestionRegex)) {
                AssessmentRichTextDataDTO assessmentRichTextDataDTO = new AssessmentRichTextDataDTO();
                assessmentRichTextDataDTO.setType("HTML");
                assessmentRichTextDataDTO.setContent(cleanHtmlTags(paragraph.html(), comprehensionQuestionUpdateRegex));

                // Handle multi-line questions
                while (i + 1 < paragraphs.size() && !paragraphs.get(i + 1).text().matches(subQuestionRegexWithSpace) && !paragraphs.get(i + 1).text().matches(subQuestionRegex) && !paragraphs.get(i + 1).text().matches(questionRegex) && !paragraphs.get(i + 1).text().startsWith("(a.)") && !paragraphs.get(i + 1).text().startsWith("Ans:")) {
                    i++;
                    Element multiLineParagraph = paragraphs.get(i);

                    assessmentRichTextDataDTO.appendContent(cleanHtmlTags(multiLineParagraph.outerHtml(), comprehensionQuestionUpdateRegex));
                }
                comprehensionRichText = assessmentRichTextDataDTO;
            }

            // Detect questions using "startsWith" for "(1C1.)" or "(1 C1.)" format
            if (text.matches(subQuestionRegex) || text.matches(subQuestionRegexWithSpace)) {

                int[] questionNumbers = extractQuestionNumbers(text);
                question = new QuestionDTO(String.valueOf(questionNumbers[0]));
                // Regex pattern to match
                question.setSectionId("1");
                question.setText(new AssessmentRichTextDataDTO(null, "HTML", cleanHtmlTags(paragraph.html(), subQuestionUpdateRegex)));
                question.setAccessLevel("PRIVATE");
                question.setQuestionResponseType(QuestionResponseType.OPTION.name());
                if (comprehensionRichText != null) {
                    question.setParentRichText(comprehensionRichText);
                }
                // Handle multi-line questions
                while (i + 1 < paragraphs.size() && !paragraphs.get(i + 1).text().startsWith("(a.)") && !paragraphs.get(i + 1).text().startsWith("Ans:")) {
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

                    question.appendQuestionHtml(cleanHtmlTags(multiLineParagraph.outerHtml(), subQuestionUpdateRegex));
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
                        question.getOptions().add(new OptionDTO(String.valueOf(question.getOptions().size()), new AssessmentRichTextDataDTO(null, "HTML", cleanHtmlTags(optionParagraph.html(), optionUpdateRegex))));
                    }
                }

                // Extract answer
                if (i + 1 < paragraphs.size() && paragraphs.get(i + 1).text().startsWith("Ans:")) {
                    i++;
                    // if options are empty then it is a numeric type question
                    if (question.getOptions().isEmpty()) {
                        question.setQuestionResponseType(QuestionResponseType.INTEGER.name());
                        String answerText = paragraphs.get(i).text();
                        String contentAfterAns = answerText.substring(ansRegex.length()).trim();
                        NumericalEvaluationDto numericalEvaluation = new NumericalEvaluationDto();
                        numericalEvaluation.setType(QuestionTypes.NUMERIC.name());
                        question.setQuestionType(QuestionTypes.NUMERIC.name());
                        OptionsJsonDto optionsJsonDto = new OptionsJsonDto();
                        optionsJsonDto.setNumericType(NumericQuestionTypes.INTEGER.name());
                        optionsJsonDto.setDecimals(2);

                        NumericalEvaluationDto.NumericalData numericalQuestionData = new NumericalEvaluationDto.NumericalData();
                        try {
                            question.setOptionsJson(setOptionsJson(optionsJsonDto));
                            // Convert String to Double before adding to the List
                            numericalQuestionData.setValidAnswers(List.of((RoundOff(2, contentAfterAns))));

                            numericalEvaluation.setData(numericalQuestionData);

                            question.setAutoEvaluationJson(setEvaluationJson(numericalEvaluation));
                            question.setParsedEvaluationObject(EvaluationJsonToMapConverter.convertJsonToMap(question.getAutoEvaluationJson()));
                        } catch (JsonProcessingException e) {
                            throw new VacademyException(e.getMessage());
                        }
                    } else {

                        String answerText = paragraphs.get(i).text();
                        String contentAfterAns = answerText.substring(ansRegex.length()).trim();
                        MCQEvaluationDTO mcqEvaluation = new MCQEvaluationDTO();
                        mcqEvaluation.setType(QuestionTypes.MCQS.name());
                        question.setQuestionType(QuestionTypes.MCQS.name());
                        MCQEvaluationDTO.MCQData mcqData = new MCQEvaluationDTO.MCQData();

                        try {
                            mcqData.setCorrectOptionIds(List.of(getAnswerId(contentAfterAns).toString()));
                            mcqEvaluation.setData(mcqData);

                            question.setAutoEvaluationJson(setEvaluationJson(mcqEvaluation));
                            question.setParsedEvaluationObject(EvaluationJsonToMapConverter.convertJsonToMap(question.getAutoEvaluationJson()));
                        } catch (JsonProcessingException e) {
                            throw new VacademyException(e.getMessage());
                        }
                    }
                }

                // Extract explanation
                if (i + 1 < paragraphs.size() && paragraphs.get(i + 1).text().startsWith("Exp:")) {
                    i++;

                    String filteredText = paragraphs.get(i).html().replaceAll(explanationRegex, "").trim();
                    question.setExplanationText(new AssessmentRichTextDataDTO(null, "HTML", cleanHtmlTags(filteredText, explanationRegex)));
                    while (i + 1 < paragraphs.size() && !(paragraphs.get(i + 1).text().startsWith("(") && Character.isDigit(paragraphs.get(i + 1).text().charAt(1)))) {
                        i++;
                        String filteredInternalText = paragraphs.get(i).outerHtml().replaceAll(explanationRegex, "").trim();

                        question.appendExplanationHtml(cleanHtmlTags(filteredInternalText, explanationRegex));
                    }
                }
            }

            // Detect questions using "startsWith" for "(number.)" format
            if (text.matches(questionRegex)) {

                int questionNumber = extractQuestionNumber(text);
                question = new QuestionDTO(String.valueOf(questionNumber));
                // Regex pattern to match
                question.setSectionId("1");
                question.setText(new AssessmentRichTextDataDTO(null, "HTML", cleanHtmlTags(paragraph.html(), questionUpdateRegex)));
                question.setAccessLevel("PRIVATE");
                question.setQuestionResponseType(QuestionResponseType.OPTION.name());
                // Handle multi-line questions
                while (i + 1 < paragraphs.size() && !paragraphs.get(i + 1).text().startsWith("(a.)") && !paragraphs.get(i + 1).text().startsWith("Ans:")) {
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
                        question.getOptions().add(new OptionDTO(String.valueOf(question.getOptions().size()), new AssessmentRichTextDataDTO(null, "HTML", cleanHtmlTags(optionParagraph.html(), optionUpdateRegex))));
                    }
                }

                // Extract answer
                if (i + 1 < paragraphs.size() && paragraphs.get(i + 1).text().startsWith("Ans:")) {
                    i++;
                    // if options are empty then it is a numeric type question
                    if (question.getOptions().isEmpty()) {

                        String answerText = paragraphs.get(i).text();
                        StringBuilder answerBuilder = new StringBuilder(answerText);

                        //multiple line ans for long answer type
                        while (i + 1 < paragraphs.size() && !paragraphs.get(i + 1).text().matches("Ans:") && !paragraphs.get(i + 1).text().matches("Exp:") && !paragraphs.get(i + 1).text().matches(subQuestionRegexWithSpace) && !paragraphs.get(i + 1).text().matches(subQuestionRegex) && !paragraphs.get(i + 1).text().matches(questionRegex) && !paragraphs.get(i + 1).text().matches(explanationRegex) && !paragraphs.get(i + 1).text().matches(comprehensionQuestionRegex) && !paragraphs.get(i + 1).text().startsWith("(a.)") && !paragraphs.get(i + 1).text().startsWith("Exp:") && !paragraphs.get(i + 1).text().startsWith("Ans:")) {
                            i++;
                            String filteredInternalText = paragraphs.get(i).outerHtml().replaceAll(ansRegex, "").trim();
                            answerBuilder.append(cleanHtmlTags(filteredInternalText, ansRegex));

                        }
                        String ans = answerBuilder.substring(ansRegex.length()).trim();
                        getAnswerType(ans, question);
                        setEvaluation(ans, question);

                    } else {

                        String answerText = paragraphs.get(i).text();
                        String contentAfterAns = answerText.substring(ansRegex.length()).trim();
                        MCQEvaluationDTO mcqEvaluation = new MCQEvaluationDTO();
                        mcqEvaluation.setType(QuestionTypes.MCQS.name());
                        question.setQuestionType(QuestionTypes.MCQS.name());
                        MCQEvaluationDTO.MCQData mcqData = new MCQEvaluationDTO.MCQData();

                        try {
                            List<String> correctOptionIds = Arrays.stream(contentAfterAns.split(","))
                                    .map(String::trim) // Remove spaces
                                    .map(option -> getAnswerId(option).toString()) // Convert to ID
                                    .toList();
                            if (correctOptionIds.size() > 1) {
                                mcqEvaluation.setType(QuestionTypes.MCQM.name());
                                question.setQuestionType(QuestionTypes.MCQM.name());
                            }
                            mcqData.setCorrectOptionIds(correctOptionIds);
                            mcqEvaluation.setData(mcqData);

                            question.setAutoEvaluationJson(setEvaluationJson(mcqEvaluation));
                            question.setParsedEvaluationObject(EvaluationJsonToMapConverter.convertJsonToMap(question.getAutoEvaluationJson()));
                        } catch (JsonProcessingException e) {
                            throw new VacademyException(e.getMessage());
                        }
                    }
                }

                // Extract explanation
                if (i + 1 < paragraphs.size() && paragraphs.get(i + 1).text().startsWith("Exp:")) {
                    i++;

                    String filteredText = paragraphs.get(i).html().replaceAll(explanationRegex, "").trim();
                    question.setExplanationText(new AssessmentRichTextDataDTO(null, "HTML", cleanHtmlTags(filteredText, explanationRegex)));
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

    private void setEvaluation(String ans, QuestionDTO question) {
        switch (question.getQuestionType()) {
            case "NUMERIC":
                // Handle numeric question type
                NumericalEvaluationDto numericalEvaluation = new NumericalEvaluationDto();
                numericalEvaluation.setType(QuestionTypes.NUMERIC.name());
                question.setQuestionType(QuestionTypes.NUMERIC.name());
                question.setQuestionResponseType(QuestionResponseType.INTEGER.name());
                OptionsJsonDto optionsJsonDto = new OptionsJsonDto();
                optionsJsonDto.setNumericType(NumericQuestionTypes.INTEGER.name());
                optionsJsonDto.setDecimals(2);

                NumericalEvaluationDto.NumericalData numericalQuestionData = new NumericalEvaluationDto.NumericalData();
                try {
                    question.setOptionsJson(setOptionsJson(optionsJsonDto));
                    // Convert String to Double before adding to the List
                    numericalQuestionData.setValidAnswers(List.of((RoundOff(2, ans))));

                    numericalEvaluation.setData(numericalQuestionData);

                    question.setAutoEvaluationJson(setEvaluationJson(numericalEvaluation));
                    question.setParsedEvaluationObject(EvaluationJsonToMapConverter.convertJsonToMap(question.getAutoEvaluationJson()));
                } catch (JsonProcessingException e) {
                    throw new VacademyException(e.getMessage());
                }
                break;
            case "ONE_WORD":
                // Handle one-word question type
                try {
                    OneWordEvaluationDTO oneWordEvaluationDTO = new OneWordEvaluationDTO();
                    oneWordEvaluationDTO.setType(QuestionTypes.ONE_WORD.name());
                    question.setQuestionResponseType(QuestionResponseType.ONE_WORD.name());
                    OneWordEvaluationDTO.OneWordEvaluationData oneWordEvaluationData = new OneWordEvaluationDTO.OneWordEvaluationData();
                    oneWordEvaluationData.setAnswer(ans);
                    oneWordEvaluationDTO.setData(oneWordEvaluationData);
                    question.setAutoEvaluationJson(setEvaluationJson(oneWordEvaluationDTO));
                } catch (JsonProcessingException e) {
                    throw new VacademyException(e.getMessage());
                }
                break;
            case "LONG_ANSWER":
                // Handle long-answer question type
                try {
                    LongAnswerEvaluationDTO longAnswerEvaluationDTO = new LongAnswerEvaluationDTO();
                    longAnswerEvaluationDTO.setType(QuestionTypes.LONG_ANSWER.name());
                    question.setQuestionResponseType(QuestionResponseType.LONG_ANSWER.name());
                    LongAnswerEvaluationDTO.LongAnswerEvaluationData longAnswerEvaluationData = new LongAnswerEvaluationDTO.LongAnswerEvaluationData();
                    AssessmentRichTextDataDTO assessmentRichTextDataDTO = new AssessmentRichTextDataDTO();
                    assessmentRichTextDataDTO.setType("HTML");
                    assessmentRichTextDataDTO.setContent(ans);
                    longAnswerEvaluationData.setAnswer(assessmentRichTextDataDTO);
                    longAnswerEvaluationDTO.setData(longAnswerEvaluationData);
                    question.setAutoEvaluationJson(setEvaluationJson(longAnswerEvaluationDTO));
                } catch (JsonProcessingException e) {
                    throw new VacademyException(e.getMessage());
                }
                break;
            default:
                // Handle unknown or unexpected question types
                throw new IllegalArgumentException("Unsupported question type: " + question.getQuestionType());
        }
    }

    private void getAnswerType(String answer, QuestionDTO question) {
        Pattern INTEGER_PATTERN = Pattern.compile("^\\d+$");          // Matches whole numbers
        Pattern DECIMAL_PATTERN = Pattern.compile("^\\d+\\.\\d+$");   // Matches decimal numbers
        Pattern ONE_WORD_PATTERN = Pattern.compile("^[a-zA-Z0-9]+$"); // Matches a single word (letters/numbers)

        if (INTEGER_PATTERN.matcher(answer).matches()) {
            question.setQuestionType(QuestionTypes.NUMERIC.name());
        } else if (DECIMAL_PATTERN.matcher(answer).matches()) {
            question.setQuestionType(QuestionTypes.NUMERIC.name());
        } else if (ONE_WORD_PATTERN.matcher(answer).matches()) {
            question.setQuestionType(QuestionTypes.ONE_WORD.name());
        } else {
            question.setQuestionType(QuestionTypes.LONG_ANSWER.name());
        }
    }

    private int extractQuestionNumber(String text) {
        // Define a regex pattern to match the question number formats
        String regex = "(\\d+)|(?:Q(\\d+))|(?:C(\\d+))";
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
            qNumberStr = matcher.group(3); // This captures the Q number if present
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

    public String setEvaluationJson(MCQEvaluationDTO mcqEvaluationDTO) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(mcqEvaluationDTO);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }

    // function for numeric json
    public String setEvaluationJson(NumericalEvaluationDto numericalEvaluationDTO) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(numericalEvaluationDTO);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }

    public String setEvaluationJson(OneWordEvaluationDTO oneWordEvaluationDTO) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(oneWordEvaluationDTO);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }

    public String setEvaluationJson(LongAnswerEvaluationDTO longAnswerEvaluationDTO) throws JsonProcessingException {
        // Convert DTO to JSON string
        String jsonString = objectMapper.writeValueAsString(longAnswerEvaluationDTO);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString; // Return the JSON string for confirmation or further processing
    }

    public String setOptionsJson(OptionsJsonDto optionsJsonDto) throws JsonProcessingException {
        String jsonString = objectMapper.writeValueAsString(optionsJsonDto);

        // Here you would save jsonString to your database (not shown)
        // For example: question.setAutoEvaluationJson(jsonString);

        return jsonString;
    }

    // Method to get evaluation JSON as DTO based on question type
    public MCQEvaluationDTO getEvaluationJson(String jsonString) throws JsonProcessingException {
        // Deserialize JSON string to DTO
        return objectMapper.readValue(jsonString, MCQEvaluationDTO.class);
    }

    public Double RoundOff(Number decimals, String value) {
//        int decimalPlaces = decimals.intValue();
        return Double.parseDouble(value);
//        double rawValue = Double.parseDouble(value);
//        return rawValue // Returns rounded value with correct decimal places
    }


}
