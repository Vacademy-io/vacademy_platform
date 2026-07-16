package vacademy.io.community_service.feature.roadmap.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.roadmap.dto.RoadmapDto;
import vacademy.io.community_service.feature.roadmap.service.ProductRoadmapService;

/** Read-only: any logged-in admin-dashboard user sees the same published roadmap. */
@RestController
@RequestMapping("/community-service/roadmap/v1")
public class RoadmapController {

    @Autowired
    private ProductRoadmapService service;

    @GetMapping("/current")
    public ResponseEntity<RoadmapDto> current(@RequestAttribute("user") CustomUserDetails user) {
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
        }
        return ResponseEntity.ok(service.get());
    }
}
