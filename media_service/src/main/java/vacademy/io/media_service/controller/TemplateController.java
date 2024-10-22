package vacademy.io.media_service.controller;

import vacademy.io.media_service.dto.ResponseTemplate;
import vacademy.io.media_service.dto.TemplatesDTO;
import vacademy.io.media_service.entity.Template;
import vacademy.io.media_service.exceptions.FileDownloadException;
import vacademy.io.media_service.repository.TemplateRepository;
import vacademy.io.media_service.service.FileService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/media")
public class TemplateController {
    @Autowired
    private FileService fileService;

    @Autowired
    private TemplateRepository templateRepository;

    @GetMapping("/get-all-templates")
    public ResponseEntity<ResponseTemplate> getAllTemplates() throws FileDownloadException {
        Iterable<Template> templates = templateRepository.findAll();
        List<TemplatesDTO> templatesDTOS = new ArrayList<>();
        templates.forEach((template -> {
            try {
                TemplatesDTO thisTemplate = new TemplatesDTO(template.getId(), fileService.getPublicUrlWithExpiryAndId(template.getFileId()), template.getTag());
                templatesDTOS.add(thisTemplate);
            } catch (FileDownloadException e) {
                throw new RuntimeException(e);
            }
        }));

        return ResponseEntity.ok(new ResponseTemplate(templatesDTOS));
    }

}