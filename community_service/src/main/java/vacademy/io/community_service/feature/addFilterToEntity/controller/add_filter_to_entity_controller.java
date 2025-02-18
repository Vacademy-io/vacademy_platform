package vacademy.io.community_service.feature.addFilterToEntity.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.addFilterToEntity.dto.add_tags_request_dto;
import vacademy.io.community_service.feature.addFilterToEntity.service.entity_tags_service;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/community-service")
public class add_filter_to_entity_controller {

    @Autowired
    private entity_tags_service entityTagsService;

    @PostMapping("/add-tags-to-entity")
    public ResponseEntity<?> addTags(@RequestAttribute("user") CustomUserDetails user , @RequestBody add_tags_request_dto requestDto) {
        try {
            entityTagsService.addTagsToEntity(user , requestDto);
            return ResponseEntity.ok("Tags added successfully!");
        }catch (IllegalArgumentException e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse);
        }
    }
}
