package vacademy.io.community_service.feature.addFilterToEntity.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.addFilterToEntity.dto.AddTagsRequestDto;
import vacademy.io.community_service.feature.addFilterToEntity.service.EntityTagsService;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/community-service")
public class addFilterToEntityController {

    @Autowired
    private EntityTagsService entityTagsService;

    @PostMapping("/add-tags-to-entity")
    public ResponseEntity<?> addTags(@RequestAttribute("user") CustomUserDetails user , @RequestBody AddTagsRequestDto requestDto) {
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
