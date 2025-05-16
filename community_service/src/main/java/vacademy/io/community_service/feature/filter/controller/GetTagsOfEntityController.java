package vacademy.io.community_service.feature.filter.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;
import vacademy.io.community_service.feature.filter.dto.AddTagsRequestDto;
import vacademy.io.community_service.feature.filter.service.EntityTagsService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/community-service")
public class GetTagsOfEntityController {

    @Autowired
    private EntityTagsService entityTagsService;

    @GetMapping("/get-tags-of-entity")
    public ResponseEntity<Map<String, Map<String, List<Object>>>> getTags(@RequestAttribute("user") CustomUserDetails user, @RequestParam String entityName, @RequestParam String entityIds) {
        try {
            List<String> entityIdsList = List.of(entityIds.split(","));
            return entityTagsService.getTags(user, entityName, entityIdsList);

        } catch (IllegalArgumentException e) {
            throw new VacademyException(e.getMessage());
        }
    }
}
