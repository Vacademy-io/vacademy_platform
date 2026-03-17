package vacademy.io.admin_core_service.features.slide.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.slide.dto.AddAudioSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.AudioSlideDTO;
import vacademy.io.admin_core_service.features.slide.dto.SlideDTO;
import vacademy.io.admin_core_service.features.slide.service.AudioSlideService;
import vacademy.io.common.auth.model.CustomUserDetails;

/**
 * REST Controller for Audio Slide operations.
 * Provides endpoints for creating, updating, and retrieving audio slides.
 */
@RestController
@RequestMapping("/admin-core-service/slide/audio-slide")
@RequiredArgsConstructor
public class AudioSlideController {

    private final AudioSlideService audioSlideService;

    /**
     * Add or update an audio slide using the full SlideDTO.
     * 
     * @param slideDTO         The slide data
     * @param chapterId        The chapter ID
     * @param instituteId      The institute ID
     * @param packageSessionId The package session ID
     * @param moduleId         The module ID
     * @param subjectId        The subject ID
     * @param userDetails      The authenticated user
     * @return The slide ID
     */
    @PostMapping("/add-or-update")
    public ResponseEntity<String> addOrUpdateAudioSlide(
            @RequestBody SlideDTO slideDTO,
            @RequestParam String chapterId,
            @RequestParam String instituteId,
            @RequestParam String packageSessionId,
            @RequestParam String moduleId,
            @RequestParam String subjectId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        String slideId = audioSlideService.addOrUpdateAudioSlide(
                slideDTO, chapterId, packageSessionId, moduleId, subjectId, userDetails);
        return ResponseEntity.ok(slideId);
    }

    /**
     * Add or update an audio slide using the simplified AddAudioSlideDTO.
     * 
     * @param addAudioSlideDTO The add audio slide data
     * @param chapterId        The chapter ID
     * @param moduleId         The module ID
     * @param subjectId        The subject ID
     * @param packageSessionId The package session ID
     * @param instituteId      The institute ID
     * @return The slide ID
     */
    @PostMapping("/add-update-audio-slide")
    public ResponseEntity<String> addUpdateAudioSlide(
            @RequestBody AddAudioSlideDTO addAudioSlideDTO,
            @RequestParam String chapterId,
            @RequestParam String moduleId,
            @RequestParam String subjectId,
            @RequestParam String packageSessionId,
            @RequestParam String instituteId) {

        String slideId = audioSlideService.addOrUpdateAudioSlideSimple(
                addAudioSlideDTO, chapterId, moduleId, subjectId, packageSessionId, instituteId);
        return ResponseEntity.ok(slideId);
    }

    /**
     * Get audio slide details by slide ID.
     * 
     * @param slideId     The slide ID
     * @param userDetails The authenticated user
     * @return The audio slide DTO
     */
    @GetMapping("/{slideId}")
    public ResponseEntity<AudioSlideDTO> getAudioSlide(
            @PathVariable String slideId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        AudioSlideDTO audioSlideDTO = audioSlideService.getAudioSlideDTOBySlideId(slideId);
        return ResponseEntity.ok(audioSlideDTO);
    }
}
