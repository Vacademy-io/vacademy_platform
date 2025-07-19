package vacademy.io.media_service.course.service.content_generation;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.openhtmltopdf.pdfboxout.PdfRendererBuilder;
import com.vladsch.flexmark.html.HtmlRenderer;
import com.vladsch.flexmark.util.data.MutableDataSet;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;
import vacademy.io.media_service.course.enums.SlideTypeEnums;
import vacademy.io.media_service.course.service.OpenRouterService;
import vacademy.io.media_service.service.FileServiceImpl;
import vacademy.io.media_service.service.InMemoryMultipartFile;

import com.vladsch.flexmark.parser.Parser;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.stream.Collectors;

@Slf4j
@Component
public class PdfContentGenerationStrategy extends IContentGenerationStrategy{

    @Autowired
    private OpenRouterService openRouterService;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private FileServiceImpl fileService;

    @Override
    public Mono<String> generateContent(String prompt, String slideType, String slidePath, String actionType, String title) {
        setSlideType(SlideTypeEnums.PDF.name());

        return openRouterService.streamAnswer(prompt, "google/gemini-2.5-flash-lite-preview-06-17")
                .collect(Collectors.joining())
                .flatMap(generatedContent -> {
                    try {
                        // Step 1: Convert markdown content to PDF (returns byte[])
                        byte[] pdfBytes = convertMarkdownToPdf(generatedContent);

                        // Step 2: Upload PDF to AWS (returns a public URL or path)
                        String pdfUrl = uploadToAws(pdfBytes, slidePath + ".pdf");

                        // Step 3: Generate client-friendly update JSON
                        setSuccess(true);
                        return Mono.just(formatSlideContentUpdate(slidePath, slideType, actionType, pdfUrl));
                    } catch (Exception e) {
                        log.error("Error during PDF conversion/upload for slide {}: {}", slidePath, e.getMessage());
                        setSuccess(false);
                        return Mono.just(formatErrorSlideContentUpdate(slidePath, slideType, actionType, e.getMessage()));
                    }
                })
                .doOnError(e -> {
                    log.error("AI generation error for slide {}: {}", slidePath, e.getMessage());
                    setSuccess(false);
                })
                .onErrorResume(e -> Mono.just(formatErrorSlideContentUpdate(slidePath, slideType, actionType, e.getMessage())));
    }

    private String uploadToAws(byte[] pdfBytes, String title) throws IOException {
        return fileService.uploadFile(new InMemoryMultipartFile("file",
                title+".pdf",
                "application/pdf",
                pdfBytes));
    }

    private byte[] convertMarkdownToPdf(String markdown) {
        // 1. Convert Markdown to HTML
        MutableDataSet options = new MutableDataSet();
        Parser parser = Parser.builder(options).build();
        HtmlRenderer renderer = HtmlRenderer.builder(options).build();

        String html = renderer.render(parser.parse(markdown));

        // Wrap in HTML template
        String fullHtml = "<html><head><meta charset='utf-8' /></head><body>" + html + "</body></html>";

        // 2. Convert HTML to PDF
        try (ByteArrayOutputStream outputStream = new ByteArrayOutputStream()) {
            PdfRendererBuilder builder = new PdfRendererBuilder();
            builder.useFastMode();
            builder.withHtmlContent(fullHtml, null);
            builder.toStream(outputStream);
            builder.run();
            return outputStream.toByteArray();
        } catch (Exception e) {
            throw new RuntimeException("Error while generating PDF", e);
        }
    }


    private String formatErrorSlideContentUpdate(String slidePath, String slideType, String actionType, String errorMessage) {
        ObjectNode errorUpdate = objectMapper.createObjectNode();
        errorUpdate.put("type", "SLIDE_CONTENT_ERROR"); // Event type for client
        errorUpdate.put("path", slidePath);
        errorUpdate.put("status", false);
        errorUpdate.put("actionType", actionType);
        errorUpdate.put("slideType", slideType);
        errorUpdate.put("errorMessage", "Failed to generate content: " + errorMessage);
        errorUpdate.put("contentData", "Error generating content for this slide. Please try again or contact support."); // User-friendly message
        return errorUpdate.toString();
    }

    private String formatSlideContentUpdate(String slidePath, String slideType, String actionType, String generatedContent) {
        ObjectNode contentUpdate = objectMapper.createObjectNode();
        contentUpdate.put("type", "SLIDE_CONTENT_UPDATE"); // Event type for client
        contentUpdate.put("path", slidePath);
        contentUpdate.put("status", true);
        contentUpdate.put("actionType", actionType);
        contentUpdate.put("slideType", slideType);
        contentUpdate.put("contentData", generatedContent);
        return contentUpdate.toString();
    }
}
