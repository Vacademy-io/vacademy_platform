package vacademy.io.community_service.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.community_service.dto.InitResponseDto;
import vacademy.io.community_service.enums.*;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/community_service/init")
public class InitController {

    @GetMapping
    public InitResponseDto getDropdownOptions(@RequestAttribute("user")CustomUserDetails user) {
        Map<String, List<String>> options = Map.of(
                "level", Arrays.stream(Level.values()).map(Enum::name).collect(Collectors.toList()),
                "stream", Arrays.stream(Stream.values()).map(Enum::name).collect(Collectors.toList()),
                "subject", Arrays.stream(Subject.values()).map(Enum::name).collect(Collectors.toList()),
                "difficulty", Arrays.stream(Difficulty.values()).map(Enum::name).collect(Collectors.toList()),
                "topic", Arrays.stream(Topic.values()).map(Enum::name).collect(Collectors.toList()),
                "type", Arrays.stream(Type.values()).map(Enum::name).collect(Collectors.toList())
        );

        return new InitResponseDto(options);
    }
}
