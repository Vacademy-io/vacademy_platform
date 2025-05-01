package vacademy.io.community_service.feature.content_structure.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.content_structure.dto.InitResponseDto;
import vacademy.io.community_service.feature.content_structure.service.InitService;

@RestController
@RequestMapping("/community-service")
public class InitController {

    @Autowired
    private InitService initService;

    @GetMapping("/init/question-filters")
    public ResponseEntity<InitResponseDto> getDropdownOptions() {
        return initService.getDropdownOptions();
    }
}
