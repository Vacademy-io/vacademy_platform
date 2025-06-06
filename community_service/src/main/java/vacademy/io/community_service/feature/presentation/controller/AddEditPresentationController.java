package vacademy.io.community_service.feature.presentation.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.community_service.feature.presentation.dto.question.AddPresentationDto;
import vacademy.io.community_service.feature.presentation.dto.question.EditPresentationDto;
import vacademy.io.community_service.feature.presentation.dto.question.PresentationSlideDto;
import vacademy.io.community_service.feature.presentation.manager.PresentationCrudManager;

import java.util.List;

@RestController
@RequestMapping("/community-service/presentation")
public class AddEditPresentationController {

    @Autowired
    PresentationCrudManager presentationCrudManager;

    @PostMapping("/add-presentation")
    public ResponseEntity<AddPresentationDto> addPresentation(@RequestBody AddPresentationDto addPresentationDto, @RequestParam(required = false) String instituteId) {
        return presentationCrudManager.addPresentation(addPresentationDto, instituteId);

    }

    @PostMapping("/edit-presentation")
    public ResponseEntity<List<PresentationSlideDto>> editPresentation(@RequestBody EditPresentationDto editPresentationDto) {
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

    // In class AddEditPresentationController

    @PostMapping("/add-slide/after/{afterSlideOrder}")
    public ResponseEntity<PresentationSlideDto> addSlideInPresentation(
            @RequestParam String presentationId,
            @PathVariable Integer afterSlideOrder,
            @RequestBody PresentationSlideDto newSlideDto) {
        return presentationCrudManager.addSlideAfterIndex(presentationId, afterSlideOrder, newSlideDto);
    }

}
