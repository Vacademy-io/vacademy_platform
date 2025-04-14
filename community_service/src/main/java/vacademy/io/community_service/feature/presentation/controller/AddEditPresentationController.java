package vacademy.io.community_service.feature.presentation.controller;


import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.PropertyNamingStrategies;
import com.fasterxml.jackson.databind.annotation.JsonNaming;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.community_service.feature.presentation.dto.question.AddPresentationDto;
import vacademy.io.community_service.feature.presentation.dto.question.EditPresentationDto;
import vacademy.io.community_service.feature.presentation.entity.Presentation;
import vacademy.io.community_service.feature.presentation.manager.PresentationCrudManager;

import java.util.List;

@RestController
@RequestMapping("/community-service/presentation")
public class AddEditPresentationController {

    @Autowired
    PresentationCrudManager presentationCrudManager;

    @PostMapping("/add-presentation")
    public ResponseEntity<String> addPresentation(@RequestBody AddPresentationDto addPresentationDto, @RequestParam(required = false) String instituteId) {
        return presentationCrudManager.addPresentation(addPresentationDto, instituteId);
    }

    @PostMapping("/edit-presentation")
    public ResponseEntity<String> editPresentation(@RequestBody EditPresentationDto editPresentationDto) {
        return presentationCrudManager.editPresentation(editPresentationDto);
    }

    @GetMapping("/get-presentation")
    public ResponseEntity<AddPresentationDto> getPresentation(@RequestParam String presentationId) {
        return presentationCrudManager.getPresentation(presentationId);
    }

    @GetMapping("/get-all-presentation")
    public ResponseEntity<List<AddPresentationDto>> getAllPresentation(@RequestParam String instituteId) {
        return presentationCrudManager.getAllPresentation(instituteId);

    }

}
