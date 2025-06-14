package vacademy.io.media_service.presentation.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.media_service.presentation.dto.ExcalidrawScene;
import vacademy.io.media_service.presentation.dto.FileDto;
import vacademy.io.media_service.presentation.service.PptConversionService;
import vacademy.io.media_service.service.FileService;

import java.io.InputStream;
import java.net.URL;
import java.util.*;


/**
 * REST Controller to handle the PPT file upload and conversion.
 */
@RestController
@RequestMapping("/media-service/convert-presentations")
class PptConversionController {

    private final PptConversionService conversionService;

    private final FileService fileService;

    public PptConversionController(PptConversionService conversionService, FileService fileService) {
        this.conversionService = conversionService;
        this.fileService = fileService;
    }

    /**
     * Endpoint to upload a PPT or PPTX file and convert it to Excalidraw JSON format.
     * @param file The uploaded PowerPoint file.
     * @return A ResponseEntity containing a list of Excalidraw scene objects.
     */
    @PostMapping("/import-ppt")
    public ResponseEntity<List<ExcalidrawScene>> importPpt(@RequestBody FileDto file) {
        if (file.fileId == null) {
            return ResponseEntity.badRequest().build();
        }

        try {
            FileDetailsDTO fileDetails = fileService.getFileDetailsWithExpiryAndId(file.fileId, 1);
            String fileUrl = fileDetails.getUrl();
            String filename = fileDetails.getFileName();

            try (InputStream inputStream = new URL(fileUrl).openStream()) {
                List<ExcalidrawScene> scenes = conversionService.convertPptToExcalidraw(inputStream, filename);
                return ResponseEntity.ok(scenes);
            }
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }
}