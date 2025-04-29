package vacademy.io.community_service.feature.question_bank.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.question_bank.dto.FilteredEntityResponseDto;
import vacademy.io.community_service.feature.question_bank.dto.RequestDto;
import vacademy.io.community_service.feature.question_bank.services.FilterEntityService;

import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/community-service")
public class GetEntityByFilters {
    @Autowired
    private FilterEntityService entityTagsService;

    @PostMapping("/get-entity")
    public ResponseEntity<FilteredEntityResponseDto> getFilteredEntityTags(@RequestAttribute("user") CustomUserDetails user, @RequestBody RequestDto filterRequest,
                                                                           @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                                           @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize) {
        FilteredEntityResponseDto filteredTags = entityTagsService.getFilteredEntityTags(filterRequest, pageNo, pageSize);
        return ResponseEntity.ok(filteredTags);
    }
}



