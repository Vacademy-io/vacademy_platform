package vacademy.io.admin_core_service.features.live_session.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.live_session.dto.RegistrationFromResponseDTO;
import vacademy.io.admin_core_service.features.live_session.service.*;
import vacademy.io.common.auth.model.CustomUserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/admin-core-service/live-session")
@RequiredArgsConstructor
public class GetRegistrationData {

    private final GetRegistrationDataService getRegistrationFromResponseDTO;

    @GetMapping("/get-registration-data")
    ResponseEntity<RegistrationFromResponseDTO> addLiveSessionStep1(@RequestParam("sessionId") String SessionId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok( getRegistrationFromResponseDTO.getRegistrationData(SessionId , user));

    }
}
