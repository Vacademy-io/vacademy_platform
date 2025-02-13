package vacademy.io.community_service.feature.init.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.feature.init.dto.InitResponseDto;
import vacademy.io.community_service.feature.init.service.InitService;

import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;
@RestController
@RequestMapping("/community-service")
public class InitController {

    @Autowired
    private InitService initService;

    @GetMapping("/inti/filters")
    public ResponseEntity<InitResponseDto> getDropdownOptions(@RequestAttribute("user") CustomUserDetails user) {
        return initService.getDropdownOptions(user);
    }
}
