package vacademy.io.media_service.presentation.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import vacademy.io.media_service.presentation.dto.ExcalidrawScene;
import vacademy.io.media_service.presentation.service.PptConversionService;

import java.io.InputStream;
import java.util.*;


/**
 * REST Controller to handle the PPT file upload and conversion.
 */
@RestController
@RequestMapping("/media-service/convert-presentations")
class PptConversionController {

    private final PptConversionService conversionService;

    public PptConversionController(PptConversionService conversionService) {
        this.conversionService = conversionService;
    }

    /**
     * Endpoint to upload a PPT or PPTX file and convert it to Excalidraw JSON format.
     * @param file The uploaded PowerPoint file.
     * @return A ResponseEntity containing a list of Excalidraw scene objects.
     */
    @PostMapping("/import-ppt")
    public ResponseEntity<List<ExcalidrawScene>> importPpt(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }

        try (InputStream inputStream = file.getInputStream()) {
            String filename = file.getOriginalFilename();
            List<ExcalidrawScene> scenes = conversionService.convertPptToExcalidraw(inputStream, filename);
            return ResponseEntity.ok(scenes);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}