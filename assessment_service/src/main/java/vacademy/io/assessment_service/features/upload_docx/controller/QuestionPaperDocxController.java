package vacademy.io.assessment_service.features.upload_docx.controller;


import org.apache.batik.transcoder.TranscoderException;
import org.apache.batik.transcoder.TranscoderInput;
import org.apache.batik.transcoder.TranscoderOutput;
import org.apache.batik.transcoder.wmf.tosvg.WMFTranscoder;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.zwobble.mammoth.DocumentConverter;

import org.zwobble.mammoth.Result;
import vacademy.io.assessment_service.features.upload_docx.dto.QuestionResponseFromDocx;
import vacademy.io.assessment_service.features.upload_docx.service.UploadDocxService;


import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.zwobble.mammoth.internal.util.Base64Encoding.streamToBase64;

@RestController
@RequestMapping("/assessment-service/question-paper/upload/docx/v1")
public class QuestionPaperDocxController {

    @Autowired
    UploadDocxService docxService;


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

    @PostMapping("/convert-doc-to-html")
    public List<QuestionResponseFromDocx> docToHtml(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "questionIdentifier", required = false) String questionIdentifier,
            @RequestParam(value = "optionIdentifier", required = false) String optionIdentifier,
            @RequestParam(value = "answerIdentifier", required = false) String answerIdentifier,
            @RequestParam(value = "explanationIdentifier", required = false) String explanationIdentifier) {

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
        return docxService.extractQuestions(html, questionIdentifier, optionIdentifier, answerIdentifier, explanationIdentifier);
    }

    private boolean isHtmlFile(MultipartFile file) {
        return "text/html".equals(file.getContentType());
    }

    private List<QuestionResponseFromDocx> extractQuestionsFromHtml(MultipartFile file, String questionIdentifier, String optionIdentifier, String answerIdentifier, String explanationIdentifier) {
        try {
            String html = new String(file.getBytes(), StandardCharsets.UTF_8);
            return docxService.extractQuestions(html, questionIdentifier, optionIdentifier, answerIdentifier, explanationIdentifier);
        } catch (IOException e) {
            e.printStackTrace();
            throw new RuntimeException("Error reading HTML file", e);
        }
    }

    private String convertDocxToHtml(MultipartFile file) {
        DocumentConverter converter = createDocumentConverter();
        String html = "";

        try {
            File tempFile = docxService.convertMultiPartToFile(file);
            Result<String> result = converter.convertToHtml(tempFile);
            html = convertBase64WmfImagesToSvg(result.getValue());
            tempFile.delete(); // Clean up temporary file
        } catch (Exception e) {
            e.printStackTrace();
            throw new RuntimeException("Error converting DOCX to HTML", e);
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


    // Helper method to convert WMF to PNG
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


    private static String getImageMimeType(String imageType) {
        switch (imageType.toLowerCase()) {
            case "jpeg":
            case "jpg":
                return "image/jpeg";
            case "png":
                return "image/png";
            case "gif":
                return "image/gif";
            default:
                return "image/png"; // Default to PNG if type is unknown
        }
    }


}
