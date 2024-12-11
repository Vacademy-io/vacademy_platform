package vacademy.io.assessment_service.features.upload_docx.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.zwobble.mammoth.DocumentConverter;
import org.zwobble.mammoth.Result;

import vacademy.io.assessment_service.features.upload_docx.dto.QuestionResponseFromDocx;
import vacademy.io.assessment_service.features.upload_docx.service.UploadDocxService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/assessment-service/question-paper/upload/docx/v1")
public class QuestionPaperDocxController {

    @Autowired
    UploadDocxService docxService;


    @PostMapping("/convert-doc-to-html")
    public List<QuestionResponseFromDocx> docToHtml(@RequestParam("file") MultipartFile file, @RequestParam("questionIdentifier") String questionIdentifier, @RequestParam("optionIdentifier") String optionIdentifier, @RequestParam("answerIdentifier") String answerIdentifier, @RequestParam("explanationIdentifier") String explanationIdentifier) {
        DocumentConverter converter = new DocumentConverter();

        String html = "";

        try {
            // Convert MultipartFile to File for processing
            File tempFile = docxService.convertMultiPartToFile(file);
            Result<String> result = converter.convertToHtml(tempFile);
            html = result.getValue();
            Set<String> warnings = result.getWarnings();
            // Clean up the temporary file
            tempFile.delete();

        } catch (IOException e) {
            e.printStackTrace();
        }
        return docxService.extractQuestions(html);

    }

}
