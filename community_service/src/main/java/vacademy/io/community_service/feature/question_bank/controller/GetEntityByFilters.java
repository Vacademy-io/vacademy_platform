package vacademy.io.community_service.feature.question_bank.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.community_service.feature.filter.entity.EntityTags;
import vacademy.io.community_service.feature.question_bank.dto.FilteredEntityResponseDto;
import vacademy.io.community_service.feature.question_bank.dto.RequestDto;
import vacademy.io.community_service.feature.question_bank.services.FilterEntityService;

import java.util.List;

@RestController
@RequestMapping("/community-service")
public class GetEntityByFilters {
    @Autowired
    private FilterEntityService entityTagsService;

    @PostMapping("/get-entity")
    public ResponseEntity<List<FilteredEntityResponseDto>> getFilteredEntityTags(@RequestBody RequestDto filterRequest) {
        List<FilteredEntityResponseDto> filteredTags = entityTagsService.getFilteredEntityTags(filterRequest);
        return ResponseEntity.ok(filteredTags);
    }
}



